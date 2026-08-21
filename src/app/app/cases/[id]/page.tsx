import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { CaseAnalysisView } from "@/components/case-analysis-view";
import { CaseComments } from "@/components/case-comments";
import { CaseClarify } from "@/components/case-clarify";
import { CaseReportCta } from "@/components/case-report-cta";
import { formatUsdCents, getCaseReportAccess } from "@/lib/case-report-quota";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ report_quota?: string; report_paid?: string; report_canceled?: string }>;
}) {
  const { id } = await params;
  const { report_quota, report_paid, report_canceled } = await searchParams;
  const user = await requireUser();
  const c = await db.case.findFirst({
    where: { id, userId: user.id },
    select: { id: true, title: true, number: true, createdAt: true, _count: { select: { issues: true } } },
  });
  if (!c) notFound();

  if (report_paid === "1") {
    const { reconcilePendingStripeTransactions } = await import("@/lib/payments");
    await reconcilePendingStripeTransactions(user.id);
    const access = await getCaseReportAccess(user, c.id);
    if (access.allowed) redirect(`/api/cases/${c.id}/report`);
  }

  const fullResults = await hasFeature(user.id, FEATURE_KEYS.CASE_FULL_RESULTS);
  const access = await getCaseReportAccess(user, c.id);

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`Case ${formatCaseNumber(c.number)} · Opened ${c.createdAt.toLocaleDateString("en-US")} · ${c._count.issues} finding${c._count.issues === 1 ? "" : "s"}`}
        actions={
          <div className="flex gap-2">
            <CaseReportCta caseId={c.id} returnPath={`/app/cases/${c.id}`} />
          </div>
        }
      />
      {(report_quota === "1" || access.paywall) && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;ve used the {access.includedLimit ?? 0} case report{access.includedLimit === 1 ? "" : "s"} included in
          your plan. Additional reports are {formatUsdCents(access.extraFeeCents)} each — use Extra report in the header
          to purchase one.
        </div>
      )}
      {report_canceled === "1" && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Extra report checkout was canceled. You can try again anytime.
        </div>
      )}
      {report_paid === "1" && access.paywall && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Payment received — your extra download unlocks as soon as the processor confirms it. Refresh this page shortly.
        </div>
      )}
      <div className="mb-6">
        <CaseClarify caseId={c.id} />
      </div>
      <CaseAnalysisView caseId={c.id} viewer={{ role: "customer", userId: user.id, fullResults }} />
      <CaseComments caseId={c.id} viewer={{ role: "customer", userId: user.id }} />
    </div>
  );
}
