/**
 * Package F — deepen customer balance-due finding once Account Transcript establishes amount.
 */

import type { TranscriptData } from "@/lib/evidence/transcript";
import { shouldNameFtaOrAep, shouldRetrieveInstallmentThresholds, neutralPenaltyReliefCopy } from "@/lib/authority-gates";

function usd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function penaltyInterestTotal(transcript: TranscriptData): number {
  return transcript.penalties.reduce((s, p) => s + Math.abs(p.amount), 0);
}

/**
 * Customer-facing balance-due finding after transcript establishes the amount.
 * Composition (tax vs penalty/interest) is stated when penalty TCs are present.
 */
export function deepenedBalanceDueFinding(opts: {
  amount: number;
  year: number | null;
  transcript: TranscriptData;
  evidenceLine: string;
  hasDocs: boolean;
}): Record<string, unknown> {
  const { amount, year, transcript, evidenceLine, hasDocs } = opts;
  const yearText = year ? String(year) : "the year in question";
  const penaltyTotal = penaltyInterestTotal(transcript);
  const hasPenaltySplit = transcript.penalties.length > 0;
  const asOf = transcript.accountBalanceAsOf;
  const compositionLine = hasPenaltySplit
    ? ` Of that, ${usd(penaltyTotal)} is assessed penalties/interest on the transcript (TC ${transcript.penalties.map((p) => p.code).join(", ")}). The remaining balance is tax and other assessments shown in the transaction codes.`
    : transcript.transactions.length > 0
      ? " Transaction codes on the transcript establish how the balance was built; no penalty/interest assessment codes (e.g. TC 276/196) appear in the extract on file."
      : "";

  const still_unclear = [
    asOf ? `Whether the balance changed after the transcript as-of date (${asOf})` : "Whether the balance changed after the transcript was issued",
    "Whether the balance is under active collection",
    ...(hasPenaltySplit ? [] : ["Whether penalties or interest are included beyond the principal shown as account balance"]),
  ];

  const nameRelief = shouldNameFtaOrAep(year);
  const installmentOk = shouldRetrieveInstallmentThresholds({
    hasDocs,
    hasTranscript: true,
    hasAmount: true,
    hasTaxYear: Boolean(year),
  });

  return {
    issue_type: "balance_due",
    item_kind: "issue",
    evidence_status: "confirmed",
    evidence_strength: "strong",
    tax_year: year,
    expected_amount: amount,
    title: `Balance due confirmed — ${usd(amount)}`,
    what_we_know: [
      `Your IRS Account Transcript shows an account balance of ${usd(amount)}`,
      year ? ` for tax year ${year}` : "",
      asOf ? ` (as of ${asOf})` : "",
      " — the IRS's own current figure.",
      compositionLine,
    ].join(""),
    our_conclusion: hasPenaltySplit
      ? `The transcript confirms ${usd(amount)} is owed${year ? ` for ${year}` : ""}, with ${usd(penaltyTotal)} identified as penalties/interest. Resolution options should be sized from this confirmed figure and composition.`
      : `The transcript confirms ${usd(amount)} is owed${year ? ` for ${year}` : ""}. Use the transaction codes on file to review how the balance was built before choosing a resolution path.`,
    still_unclear,
    explanations: [],
    confidence: "high",
    priority: "high",
    state: "review",
    next_action: "REVIEW",
    alternative_action: "Have a TaxOnMe professional evaluate the resolution options with you.",
    analysis_outline: [
      {
        heading: "Your situation",
        detail: `The IRS Account Transcript establishes a balance of ${usd(amount)}${year ? ` for ${yearText}` : ""}.`,
      },
      {
        heading: "Tax rules",
        detail: installmentOk
          ? `An IRS balance is tax + penalties + interest; installment options under IRC §6159 are amount-based. ${neutralPenaltyReliefCopy(year)}`
          : `An IRS balance is tax + penalties + interest. Confirm composition from transcript codes before sizing options.`,
        source: "IRC §6159 · Form 9465 instructions · IRM 20.1.1",
      },
      { heading: "Your evidence", detail: evidenceLine },
      {
        heading: "Our conclusion",
        detail: hasPenaltySplit
          ? `Confirmed balance ${usd(amount)} with ${usd(penaltyTotal)} in penalty/interest codes.${nameRelief ? ` Period ${year} is known for relief-program evaluation.` : ""}`
          : `Confirmed balance ${usd(amount)} from the Account Transcript.`,
      },
      {
        heading: "Your next move",
        detail: installmentOk
          ? "Review the confirmed balance and composition, then prepare a payment plan request (Form 9465) if you need time to pay — completing the wizard is not IRS approval."
          : "Review the transcript codes and confirm whether collection activity is underway.",
      },
    ],
  };
}
