import "server-only";
import { db } from "./db";
import { runStage } from "./ai/orchestrator";
import { STAGE_KEYS } from "./constants";
import { getNumberSetting } from "./settings";
import { formatCaseNumber } from "./case-number";
import { logSystem } from "./syslog";

// Closing remarks & final review: a dedicated AI stage (admin-configurable
// like every other pipeline stage) writes the case's closing summary; a
// deterministic builder covers the no-AI case. Cases auto-close after an
// admin-set number of days once completed, or when abandoned.

const usd = (cents: number | null) =>
  cents === null ? null : (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

async function deterministicClosing(caseId: string, reason: "completed" | "abandoned" | "manual"): Promise<string> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      issues: true,
      pathSteps: { orderBy: { sortOrder: "asc" } },
      documents: { where: { deletedAt: null } },
      deadlines: true,
    },
  });
  if (!c) return "";
  const done = c.pathSteps.filter((s) => s.status === "done").length;
  const resolved = c.issues.filter((i) => i.state === "resolved").length;
  const open = c.issues.length - resolved;
  const opened = c.createdAt.toLocaleDateString("en-US");
  const lastActivity = c.updatedAt.toLocaleDateString("en-US");

  const lines: string[] = [];
  lines.push(
    reason === "abandoned"
      ? `This case was opened on ${opened} and has had no activity since ${lastActivity}, so we're closing it to keep your account tidy. Nothing is lost — every document and finding stays in your account, and you can start a new case (or ask us to continue this one) at any time.`
      : `Final review of your case, opened ${opened} and closed ${new Date().toLocaleDateString("en-US")}.`,
  );
  lines.push("");
  lines.push(`What was covered: ${c.issues.length} item${c.issues.length === 1 ? "" : "s"} were identified and analyzed${resolved ? `, ${resolved} resolved` : ""}${open ? `, ${open} still open` : ""}. You completed ${done} of ${c.pathSteps.length} path steps and provided ${c.documents.length} document${c.documents.length === 1 ? "" : "s"}. Case readiness reached ${c.readinessScore}%.`);
  for (const i of c.issues) {
    const amount = usd(i.differenceCents) ?? usd(i.expectedCents);
    lines.push(`• ${i.taxYear ? `${i.taxYear} — ` : ""}${i.title}${amount ? ` (${amount})` : ""}: ${i.state === "resolved" ? "resolved." : i.conclusion || "see the analysis for the remaining step."}`);
  }
  const openSteps = c.pathSteps.filter((s) => s.status !== "done");
  if (openSteps.length && reason !== "completed") {
    lines.push("");
    lines.push(`If you pick this back up, the next step was: ${openSteps[0].title}.`);
  }
  lines.push("");
  lines.push(
    reason === "completed"
      ? "Keep your documents and any IRS confirmation letters safe — they're your proof if the IRS revisits the year. If a new notice arrives, start a new case and we'll pick up with everything we already know."
      : "Your documents remain in your vault. When you're ready to continue, start a fresh case or add new documents — everything you've provided carries over.",
  );
  return lines.join("\n");
}

/** Generate closing remarks (AI stage when configured, deterministic otherwise) and close the case. */
export async function closeCase(caseId: string, reason: "completed" | "abandoned" | "manual"): Promise<void> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { issues: true, pathSteps: true, documents: { where: { deletedAt: null } } },
  });
  if (!c || c.status === "closed") return;

  let remarks = "";
  // A closing summary is the last thing the customer reads, so it recounts the
  // evidence the case was decided on rather than a list of issue titles.
  const { buildEvidenceBrief } = await import("./evidence/brief");
  const brief = await buildEvidenceBrief(caseId);
  try {
    const outcome = await runStage(STAGE_KEYS.CLOSING, {
      input: JSON.stringify({
        reason,
        situation: c.situation,
        goal: c.goal,
        readiness: c.readinessScore,
        issues: c.issues.map((i) => ({ title: i.title, state: i.state, conclusion: i.conclusion, tax_year: i.taxYear })),
        steps_done: c.pathSteps.filter((s) => s.status === "done").map((s) => s.title),
        steps_open: c.pathSteps.filter((s) => s.status !== "done").map((s) => s.title),
        documents: c.documents.map((d) => d.docKind),
      }),
      full_case_history: JSON.stringify({ reason, situation: c.situation, goal: c.goal }),
      case_evidence: brief.text,
      final_issue_states: JSON.stringify(c.issues.map((i) => ({ title: i.title, state: i.state, conclusion: i.conclusion, tax_year: i.taxYear }))),
      completed_actions: JSON.stringify(c.pathSteps.filter((s) => s.status === "done").map((s) => s.title)),
      professional_updates: "(none supplied)",
      documents: JSON.stringify(c.documents.map((d) => d.docKind)),
      future_obligations: JSON.stringify(c.pathSteps.filter((s) => s.status !== "done").map((s) => s.title)),
    });
    const parsed = outcome.stepOutputs.find((o) => o.data)?.data as Record<string, unknown> | undefined;
    if (parsed && typeof parsed.closing_remarks === "string" && parsed.closing_remarks.trim()) {
      remarks = String(parsed.closing_remarks);
    } else if (parsed && typeof parsed.customer_summary === "string" && parsed.customer_summary.trim()) {
      remarks = String(parsed.customer_summary);
    } else if (outcome.usedAi) {
      remarks = outcome.stepOutputs.find((o) => o.rawText.trim())?.rawText ?? "";
    }
  } catch (err) {
    await logSystem("error", "ai_call", "Closing-remarks stage failed — using the deterministic summary", String(err));
  }
  if (!remarks.trim()) remarks = await deterministicClosing(caseId, reason);

  await db.case.update({
    where: { id: caseId },
    data: { status: "closed", closedAt: new Date(), closedReason: reason, closingRemarks: remarks },
  });
  if (c.userId) {
    await db.notification.create({
      data: {
        userId: c.userId,
        kind: "case_closed",
        title: `Case ${formatCaseNumber(c.number)} closed — final review inside`,
        body: reason === "abandoned"
          ? "We closed this case after a period of inactivity. Your documents are safe and you can pick it back up anytime."
          : "Your case is complete. Read your closing remarks and final review on the case page.",
        link: `/app/cases/${caseId}`,
      },
    });
  }
}

/**
 * Auto-close sweep (runs from the maintenance endpoint):
 * - COMPLETED cases (every path step done) close N days after their last activity.
 * - ABANDONED cases (no activity at all) close after M days.
 * Both windows are admin-set in Settings → Cases.
 */
export async function autoCloseCases(): Promise<number> {
  const completedDays = await getNumberSetting("cases.autoclose_completed_days", 14);
  const abandonedDays = await getNumberSetting("cases.autoclose_abandoned_days", 60);
  const candidates = await db.case.findMany({
    where: { status: { notIn: ["closed"] }, userId: { not: null } },
    include: { pathSteps: true },
  });
  let closed = 0;
  const now = Date.now();
  for (const c of candidates) {
    const idleDays = (now - c.updatedAt.getTime()) / 86400000;
    const complete = c.pathSteps.length > 0 && c.pathSteps.every((s) => s.status === "done");
    try {
      if (complete && completedDays > 0 && idleDays >= completedDays) {
        await closeCase(c.id, "completed");
        closed++;
      } else if (!complete && abandonedDays > 0 && idleDays >= abandonedDays) {
        await closeCase(c.id, "abandoned");
        closed++;
      }
    } catch (err) {
      await logSystem("error", "cases", `Auto-close failed for case ${formatCaseNumber(c.number)}`, String(err));
    }
  }
  return closed;
}
