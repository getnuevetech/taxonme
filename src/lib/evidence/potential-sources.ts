/**
 * Package B — potential evidence sources ranked by matter state (not issue-type mandates).
 */

export type PotentialEvidenceSource = {
  kind: string;
  label: string;
  hint: string;
  rank: number;
};

export type EvidenceMatter = {
  issueTypes: string[];
  hasTranscript: boolean;
  hasNotice: boolean;
  hasReturn: boolean;
  hasIncomeDocs: boolean;
  taxYear: number | null;
  amountKnown: boolean;
  unfiledDominant: boolean;
  narrativeMentionsNotice?: boolean;
};

export function rankPotentialEvidenceSources(matter: EvidenceMatter): PotentialEvidenceSource[] {
  const year = matter.taxYear ? ` (${matter.taxYear})` : "";
  const out: PotentialEvidenceSource[] = [];
  const push = (kind: string, label: string, hint: string, rank: number) => {
    if (out.some((d) => d.kind === kind)) return;
    out.push({ kind, label, hint, rank });
  };

  const debtLike = matter.issueTypes.some((t) =>
    ["balance_due", "refund_discrepancy", "penalty", "notice_response"].includes(t),
  );

  if (!matter.hasTranscript && (debtLike || matter.unfiledDominant)) {
    push(
      "transcript",
      matter.unfiledDominant ? `IRS Wage & Income Transcript${year}` : `IRS Account Transcript${year}`,
      matter.unfiledDominant
        ? "Lists W-2/1099 income the IRS received — best start for unfiled years."
        : "Usually the best source for current balance, payments, penalties, interest, and recent IRS activity.",
      10,
    );
  }

  if (
    !matter.hasNotice &&
    (matter.issueTypes.includes("notice_response") || matter.narrativeMentionsNotice)
  ) {
    push(
      "notice",
      "IRS notice or letter",
      "Establishes what prompted the concern, amounts stated, and any response deadline.",
      20,
    );
  }

  // Defer Form 1040 until transcript/notice exists, or refund comparison needs it.
  const needReturnCompare =
    matter.issueTypes.includes("refund_discrepancy") && matter.amountKnown && matter.hasTranscript;
  if (!matter.hasReturn && needReturnCompare) {
    push(
      "1040",
      `Tax return (Form 1040)${year}`,
      "Useful to compare what was claimed against what the IRS shows after transcript review.",
      40,
    );
  }

  if (matter.unfiledDominant && !matter.hasIncomeDocs) {
    push("w2", "Income documents (W-2s)", "Helps reconstruct unfiled years.", 50);
    push("1099", "Income documents (1099s)", "Freelance/interest/brokerage income forms.", 55);
  }

  return out.sort((a, b) => a.rank - b.rank);
}
