import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { CaseAnalysisView } from "@/components/case-analysis-view";
import { CaseComments } from "@/components/case-comments";
import { CaseReportCta } from "@/components/case-report-cta";
import { formatUsdCents, getCaseReportAccess } from "@/lib/case-report-quota";

// Consultants see EXACTLY what the customer sees — same analysis, findings,
// walkthroughs, and plan — in read-and-review mode with the case discussion.
export default async function ConsultantCaseViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; caseId: string }>;
  searchParams: Promise<{ report_quota?: string; report_paid?: string; report_canceled?: string }>;
}) {
  const { id, caseId } = await params;
  const { report_quota, report_paid, report_canceled } = await searchParams;
  const user = await requireUser();
  const assignment = await db.consultantAssignment.findFirst({
    where: { id, consultantId: user.id, status: "active" },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!assignment) notFound();
  const c = await db.case.findFirst({
    where: { id: caseId, userId: assignment.user.id },
    select: { id: true, title: true, number: true, createdAt: true },
  });
  if (!c) notFound();

  if (report_paid === "1") {
    const { reconcilePendingStripeTransactions } = await import("@/lib/payments");
    await reconcilePendingStripeTransactions(user.id);
    const paidAccess = await getCaseReportAccess(user, c.id);
    if (paidAccess.allowed) redirect(`/api/cases/${c.id}/report`);
  }

  const access = await getCaseReportAccess(user, c.id);

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`Case ${formatCaseNumber(c.number)} · ${assignment.user.firstName} ${assignment.user.lastName} · opened ${c.createdAt.toLocaleDateString("en-US")} — you see the same analysis as your client`}
        actions={
          <div className="flex gap-2">
            <CaseReportCta caseId={c.id} returnPath={`/consultant/clients/${assignment.id}/cases/${c.id}`} />
            <Link href={`/consultant/clients/${assignment.id}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              ← Client workspace
            </Link>
          </div>
        }
      />
      {(report_quota === "1" || access.paywall) && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;ve used the case reports included in your plan. Additional reports are {formatUsdCents(access.extraFeeCents)} each.
        </div>
      )}
      {report_canceled === "1" && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Extra report checkout was canceled. You can try again anytime.
        </div>
      )}
      <CaseAnalysisView caseId={c.id} viewer={{ role: "consultant", userId: user.id }} />
      <CaseComments caseId={c.id} viewer={{ role: "consultant", userId: user.id }} />
    </div>
  );
}
