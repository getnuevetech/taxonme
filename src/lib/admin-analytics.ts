import "server-only";
import { db } from "./db";

// Aggregates the entire platform's statistics for the admin analytics dashboard.

const DAY = 24 * 3600000;

function dayBuckets(days: number): { start: Date; label: string }[] {
  const out: { start: Date; label: string }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    out.push({ start: d, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
  }
  return out;
}

function bucketize(dates: Date[], days: number): { label: string; value: number }[] {
  const buckets = dayBuckets(days);
  return buckets.map((b, i) => {
    const end = i === buckets.length - 1 ? new Date(b.start.getTime() + DAY) : buckets[i + 1].start;
    return { label: b.label, value: dates.filter((d) => d >= b.start && d < end).length };
  });
}

export async function getAdminAnalytics() {
  const since30 = new Date(Date.now() - 30 * DAY);
  const since60 = new Date(Date.now() - 60 * DAY);

  const [
    customersTotal, customersNew30, customersNewPrev30,
    consultantsTotal, consultantsApproved, consultantsPending,
    adminCount, suspended, deleted,
    signupDates, caseDates, txSucceeded30Rows,
    casesTotal, caseStatusGroups, avgReadiness, issueTypeGroups,
    activeSubs, txStatusGroups, revenueAll, revenue30, revenuePrev30,
    ticketsOpen, ticketQueueGroups, ticketStatusGroups, csat, firstResponses,
    assignments, autoAssigned, docsCount, formsCompleted, lettersCount, noticesCount,
    qaMessages, guideThreads, messagesSent, messagesEmailed,
    providers, aiCallsOk, aiCallsFailed, runsTotal, runsWithAi,
  ] = await Promise.all([
    db.user.count({ where: { role: "user", status: { not: "deleted" } } }),
    db.user.count({ where: { role: "user", createdAt: { gte: since30 } } }),
    db.user.count({ where: { role: "user", createdAt: { gte: since60, lt: since30 } } }),
    db.user.count({ where: { role: "consultant", status: { not: "deleted" } } }),
    db.consultantProfile.count({ where: { status: "approved" } }),
    db.consultantProfile.count({ where: { status: "pending" } }),
    db.user.count({ where: { role: { in: ["admin", "super_admin"] } } }),
    db.user.count({ where: { status: "suspended" } }),
    db.user.count({ where: { status: "deleted" } }),
    db.user.findMany({ where: { role: { in: ["user", "consultant"] }, createdAt: { gte: since30 } }, select: { createdAt: true } }),
    db.case.findMany({ where: { createdAt: { gte: since30 } }, select: { createdAt: true } }),
    db.paymentTransaction.findMany({ where: { status: "succeeded", createdAt: { gte: since30 } }, select: { createdAt: true, amountCents: true } }),
    db.case.count(),
    db.case.groupBy({ by: ["status"], _count: true }),
    db.case.aggregate({ _avg: { readinessScore: true } }),
    db.issue.groupBy({ by: ["issueType"], _count: true }),
    db.subscription.findMany({
      where: { status: { in: ["active", "trialing"] }, OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date() } }] },
      include: { plan: { select: { name: true, priceMonthlyCents: true, priceYearlyCents: true, audience: true } } },
    }),
    db.paymentTransaction.groupBy({ by: ["status"], _count: true }),
    db.paymentTransaction.aggregate({ where: { status: "succeeded" }, _sum: { amountCents: true } }),
    db.paymentTransaction.aggregate({ where: { status: "succeeded", createdAt: { gte: since30 } }, _sum: { amountCents: true } }),
    db.paymentTransaction.aggregate({ where: { status: "succeeded", createdAt: { gte: since60, lt: since30 } }, _sum: { amountCents: true } }),
    db.ticket.count({ where: { status: { in: ["open", "in_progress"] } } }),
    db.ticket.groupBy({ by: ["category"], _count: true }),
    db.ticket.groupBy({ by: ["status"], _count: true }),
    db.ticket.aggregate({ where: { csatRating: { not: null } }, _avg: { csatRating: true }, _count: { csatRating: true } }),
    db.ticket.findMany({ where: { firstResponseAt: { not: null } }, select: { createdAt: true, firstResponseAt: true }, take: 500, orderBy: { createdAt: "desc" } }),
    db.consultantAssignment.groupBy({ by: ["status"], _count: true }),
    db.consultantAssignment.count({ where: { autoAssigned: true } }),
    db.document.count({ where: { deletedAt: null } }),
    db.formSubmission.count({ where: { status: "completed" } }),
    db.responseLetter.count(),
    db.notice.count(),
    db.qaMessage.count({ where: { role: "user" } }),
    db.qaThread.count({ where: { kind: "guide" } }),
    db.messageLog.count(),
    db.messageLog.count({ where: { emailSent: true } }),
    db.aiProvider.count({ where: { isEnabled: true, apiKey: { not: "" } } }),
    db.analysisStepResult.count({ where: { status: "complete" } }),
    db.analysisStepResult.count({ where: { status: "failed" } }),
    db.analysisRun.count(),
    db.analysisRun.count({ where: { stepResults: { some: { status: "complete" } } } }),
  ]);

  // MRR: monthly-equivalent value of every active subscription.
  const mrrCents = activeSubs.reduce((sum, s) => {
    const monthly = s.interval === "yearly" ? Math.round(s.plan.priceYearlyCents / 12) : s.plan.priceMonthlyCents;
    return sum + monthly;
  }, 0);
  const planMix = new Map<string, number>();
  for (const s of activeSubs) planMix.set(s.plan.name, (planMix.get(s.plan.name) ?? 0) + 1);

  // Revenue per day (cents → dollars).
  const buckets = dayBuckets(30);
  const revenueSeries = buckets.map((b, i) => {
    const end = i === buckets.length - 1 ? new Date(b.start.getTime() + DAY) : buckets[i + 1].start;
    const cents = txSucceeded30Rows.filter((t) => t.createdAt >= b.start && t.createdAt < end).reduce((s, t) => s + t.amountCents, 0);
    return { label: b.label, value: Math.round(cents / 100) };
  });

  const avgFirstResponseHours =
    firstResponses.length > 0
      ? Math.round(
          (firstResponses.reduce((s, t) => s + (t.firstResponseAt!.getTime() - t.createdAt.getTime()), 0) /
            firstResponses.length /
            3600000) * 10,
        ) / 10
      : null;

  return {
    users: {
      customersTotal, customersNew30, customersDelta: customersNew30 - customersNewPrev30,
      consultantsTotal, consultantsApproved, consultantsPending, adminCount, suspended, deleted,
      signupSeries: bucketize(signupDates.map((x) => x.createdAt), 30),
    },
    revenue: {
      totalCents: revenueAll._sum.amountCents ?? 0,
      last30Cents: revenue30._sum.amountCents ?? 0,
      prev30Cents: revenuePrev30._sum.amountCents ?? 0,
      mrrCents,
      activeSubscriptions: activeSubs.length,
      planMix: Array.from(planMix.entries()).map(([label, value]) => ({ label, value })),
      txByStatus: txStatusGroups.map((g) => ({ label: g.status, value: g._count })),
      revenueSeries,
    },
    cases: {
      total: casesTotal,
      byStatus: caseStatusGroups.map((g) => ({ label: g.status.replace(/_/g, " "), value: g._count })),
      avgReadiness: Math.round(avgReadiness._avg.readinessScore ?? 0),
      issuesByType: issueTypeGroups.map((g) => ({ label: g.issueType.replace(/_/g, " "), value: g._count })).sort((a, b) => b.value - a.value),
      caseSeries: bucketize(caseDates.map((x) => x.createdAt), 30),
    },
    tickets: {
      open: ticketsOpen,
      byQueue: ticketQueueGroups.map((g) => ({ label: g.category === "tech_support" ? "Tech support" : "Customer service", value: g._count })),
      byStatus: ticketStatusGroups.map((g) => ({ label: g.status.replace(/_/g, " "), value: g._count })),
      csatAvg: csat._count.csatRating ? Math.round((csat._avg.csatRating ?? 0) * 10) / 10 : null,
      csatCount: csat._count.csatRating,
      avgFirstResponseHours,
    },
    consultantsOps: {
      assignmentsByStatus: assignments.map((g) => ({ label: g.status.replace(/_/g, " "), value: g._count })),
      autoAssigned,
    },
    content: { docsCount, formsCompleted, lettersCount, noticesCount, qaMessages, guideThreads, messagesSent, messagesEmailed },
    engine: {
      providers,
      aiCallsOk,
      aiCallsFailed,
      callSuccessRate: aiCallsOk + aiCallsFailed > 0 ? Math.round((aiCallsOk / (aiCallsOk + aiCallsFailed)) * 100) : null,
      runsTotal,
      runsWithAi,
    },
  };
}
