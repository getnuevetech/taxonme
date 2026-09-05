/**
 * Package C — path steps from ranked analysis; resolution eligibility gates.
 */
import type { EvidenceSnapshot } from "@/lib/ai/evidence-proportional";
import type { RankedAction } from "@/lib/action-priority";

export type PathStepDraft = { title: string; description: string; action_key: string };

const ACTION_KEY_BY_ID: Record<string, string> = {
  UPLOAD_ACCOUNT_TRANSCRIPT: "GET_TRANSCRIPT",
  CONFIRM_TAX_YEAR: "",
  RESPOND_TO_NOTICE: "DRAFT_LETTER",
  ADDRESS_LEVY_RISK: "ADD_DEADLINE",
  COMPLETE_FORM_9465: "COMPLETE_FORM_9465",
  REQUEST_PENALTY_RELIEF: "DRAFT_LETTER",
};

export function resolutionEligibility(ev: EvidenceSnapshot & { hasTaxYear?: boolean }): {
  installment: boolean;
  penaltyRelief: boolean;
} {
  const amountOk = Boolean(ev.hasAmount);
  const yearOk = Boolean(ev.hasTaxYear);
  return {
    installment: amountOk,
    // Penalty relief path only when amount known and either transcript penalties or year known.
    penaltyRelief: amountOk && (yearOk || (ev.transcriptPenaltyCount ?? 0) > 0 || Boolean(ev.hasTranscript)),
  };
}

export function pathStepsFromRankedActions(actions: RankedAction[]): PathStepDraft[] {
  return actions.slice(0, 6).map((a) => ({
    title: a.title,
    description: a.why,
    action_key: ACTION_KEY_BY_ID[a.action_id] ?? "",
  }));
}

export function filterResolutionPathSteps(
  steps: PathStepDraft[],
  eligibility: { installment: boolean; penaltyRelief: boolean },
): PathStepDraft[] {
  return steps.filter((s) => {
    const t = `${s.title} ${s.action_key}`.toLowerCase();
    if (!eligibility.installment && /(9465|payment plan|installment)/i.test(t)) return false;
    if (!eligibility.penaltyRelief && /(penalty relief|abatement)/i.test(t)) return false;
    return true;
  });
}

/** Evidence-gathering stub path for thin intakes (no resolution playbook). */
export function thinEvidencePathSteps(opts: {
  hasDocs: boolean;
  hasTranscript: boolean;
  unfiledDominant?: boolean;
}): PathStepDraft[] {
  const steps: PathStepDraft[] = [
    {
      title: opts.hasDocs ? "Add the IRS records that establish your account" : "Add your IRS account records",
      description: opts.hasDocs
        ? "Upload an Account Transcript or IRS notice — not just any file. Completes when required evidence kinds are on file."
        : "Upload an IRS Account Transcript or notice showing what the IRS currently reports. Completes when those records are on file.",
      action_key: "UPLOAD_DOCUMENTS",
    },
  ];
  if (!opts.hasTranscript) {
    steps.push({
      title: opts.unfiledDominant ? "Get your IRS Wage & Income Transcript" : "Get your IRS Account Transcript",
      description:
        "The transcript is the IRS's own record of balances, payments, and activity. Completes when a transcript is in your case documents.",
      action_key: "GET_TRANSCRIPT",
    });
  }
  steps.push({
    title: "Confirm the analysis against your documents",
    description:
      "After required records are uploaded and readable, re-run analysis so findings are checked against evidence — not just against a refresh.",
    action_key: "REVIEW_ANALYSIS",
  });
  return steps;
}
