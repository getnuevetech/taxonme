import { ActionForm, SubmitButton } from "./action-form";
import { purchaseCaseReportExtraAction } from "@/actions/billing";
import { formatUsdCents, getCaseReportAccess } from "@/lib/case-report-quota";
import { getCurrentUser } from "@/lib/auth";

export async function CaseReportCta({
  caseId,
  returnPath,
}: {
  caseId: string;
  returnPath: string;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const access = await getCaseReportAccess(user, caseId);
  if (access.forbidden) return null;

  const linkClass =
    "rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50";

  if (access.billingRedirect) {
    return (
      <a href={access.billingRedirect} className={linkClass} title="A partner plan is required to open client reports">
        Case report 🔒
      </a>
    );
  }

  if (access.allowed) {
    const remainingLabel =
      access.remaining === null || access.alreadyDownloaded
        ? "Case report ↗"
        : access.remaining === 1
          ? "Case report · 1 left ↗"
          : `Case report · ${access.remaining} left ↗`;
    return (
      <a
        href={`/api/cases/${caseId}/report`}
        target="_blank"
        rel="noreferrer"
        className={linkClass}
        title={
          access.alreadyDownloaded
            ? "Open the printable case report"
            : access.remaining === null
              ? "Open the printable case report"
              : `${access.remaining} included download${access.remaining === 1 ? "" : "s"} remaining on your plan`
        }
      >
        {remainingLabel}
      </a>
    );
  }

  return (
    <ActionForm action={purchaseCaseReportExtraAction} successMessage="Payment confirmed.">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <SubmitButton className="!bg-white !px-4 !py-2 !text-slate-700 !shadow-none ring-1 ring-slate-300 hover:!bg-slate-50">
        Extra report · {formatUsdCents(access.extraFeeCents)}
      </SubmitButton>
    </ActionForm>
  );
}
