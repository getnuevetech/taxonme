/**
 * Package A — evidence-proportional presentation helpers.
 * Depth must match evidence; unsupported modules emit empty / are omitted.
 */

export type EvidenceSnapshot = {
  hasDocs: boolean;
  hasTranscript: boolean;
  hasAmount: boolean;
  hasTaxYear: boolean;
  offsetConfirmed?: boolean;
  transcriptPenaltyCount?: number;
};

export function shouldEmitExplanations(ev: EvidenceSnapshot): boolean {
  // Speculative "most likely explanations" only after arithmetic or transcript-backed facts.
  if (ev.offsetConfirmed) return true;
  if (ev.hasTranscript && ev.hasAmount) return true;
  return false;
}

export function shouldEmitPenaltyReliefIssue(ev: EvidenceSnapshot, textMentionsPenalty: boolean): boolean {
  // Keyword "penalty" alone is not enough — need transcript-assessed penalties or confirmed amount+year.
  if (!textMentionsPenalty) return false;
  if ((ev.transcriptPenaltyCount ?? 0) > 0) return true;
  if (ev.hasTranscript && ev.hasAmount && ev.hasTaxYear) return true;
  return false;
}

export function shouldEmitPrematureResolutionPath(ev: EvidenceSnapshot): boolean {
  // Installment / penalty-relief path steps require an established amount (Package A honesty).
  return ev.hasAmount;
}

type ThinFindingOpts = {
  year: number | null;
  hasDocs: boolean;
  docCount: number;
  guidance: { what: string; action: string; state: string };
  evidenceLine: string;
};

/**
 * Sparse balance-due finding when the user reports owing without an amount.
 * No explanations, no $50k thresholds, no FTA.
 */
export function thinBalanceDueFinding(opts: ThinFindingOpts): Record<string, unknown> {
  const yearLabel = opts.year ? `${opts.year} ` : "";
  const yearText = opts.year ? String(opts.year) : "the relevant";
  return {
    issue_type: "balance_due",
    item_kind: "missing_info",
    evidence_status: "needs_verification",
    evidence_strength: "limited",
    tax_year: opts.year,
    title: opts.year ? `Possible ${yearLabel}IRS balance — records needed` : "IRS balance needs to be identified",
    what_we_know: [
      "You report that you may owe the IRS, but the amount and tax period are not established yet.",
      opts.hasDocs
        ? `${opts.docCount} document${opts.docCount === 1 ? " is" : "s are"} on file; Account Transcript or notice records are still the best way to confirm what the IRS currently shows.`
        : "No IRS account records are on file yet.",
    ].join(" "),
    our_conclusion:
      "At this stage TaxOnMe should identify what the IRS shows — not guess resolution options. An Account Transcript or IRS notice establishes the period, balance, and recent activity.",
    still_unclear: [
      "Your IRS account position (tax period, current balance, payments/credits, penalties or interest if any)",
      "Whether you have an IRS notice or letter that prompted this concern",
    ],
    // Empty — UI omits "Most likely explanations" when empty.
    explanations: [],
    confidence: "low",
    priority: "medium",
    state: opts.guidance.state,
    next_action: opts.guidance.action,
    alternative_action: "Upload an IRS notice if you have one, or use Help me get my transcript.",
    analysis_outline: [
      {
        heading: "Your situation",
        detail:
          "You told us you may owe the IRS but do not know the current amount or what to do next. That is enough to start — not enough to recommend a resolution.",
      },
      {
        heading: "What we need",
        detail: `An IRS Account Transcript for ${yearText} year(s) (or the notice stating the balance) lets us reconstruct what created the balance before evaluating options.`,
      },
      { heading: "Your evidence", detail: opts.evidenceLine },
      {
        heading: "Your next move",
        detail:
          "Upload your Account Transcript or IRS notice. If you have neither, use the transcript help path — do not invent an amount to unlock options.",
      },
    ],
  };
}
