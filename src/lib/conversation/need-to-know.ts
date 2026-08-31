import type { Answerability, NeedToKnowItem, QuestionContract } from "./types";

/** Need-to-know clarify — only critical_now + changes_branch. */
export function buildNeedToKnow(opts: {
  contract: QuestionContract;
  message: string;
  answerability: Answerability;
}): NeedToKnowItem[] {
  const text = opts.message;
  const items: NeedToKnowItem[] = [];

  const knownAbilityToPay = /\b(can'?t pay|cannot pay|can pay|payment plan|installment|hardship)\b/i.test(text);
  const knownNoticeCode = /\b(cp\s?-?\d{3,4}|lt\s?-?\d+|notice\s+(cp|lt)\s?-?\d+)\b/i.test(text);
  const knownTaxYear = /\b(20\d{2}|tax year|ty\s*20\d{2})\b/i.test(text);

  if (
    (opts.contract.decision_target === "identify_available_pathways" ||
      /\b(owe|balance|can'?t pay|payment)\b/i.test(text)) &&
    !knownAbilityToPay
  ) {
    items.push({
      question: "Can you make any monthly payment toward the balance, or is paying anything right now impossible?",
      tier: "critical_now",
      reason: "Determines installment agreement vs Currently Not Collectible vs other relief paths.",
      changes_branch: true,
      branches_affected: ["installment_agreement", "currently_not_collectible", "offer_in_compromise"],
    });
  }

  if (opts.contract.decision_target === "explain_document_or_notice" && !knownNoticeCode) {
    items.push({
      question: "What is the notice code printed near the top (for example CP2000 or LT11)?",
      tier: "critical_now",
      reason: "Notice codes define what the IRS wants and the usual next steps.",
      changes_branch: true,
      branches_affected: ["respond_by_deadline", "verify_irs_figures"],
    });
  }

  if (
    opts.contract.decision_target === "identify_available_pathways" &&
    !knownTaxYear &&
    /\b(owe|balance|years?|back taxes)\b/i.test(text)
  ) {
    items.push({
      question: "Which tax year(s) does this balance cover?",
      tier: "soon",
      reason: "Relief options and deadlines are year-specific.",
      changes_branch: false,
      branches_affected: [],
    });
  }

  if (opts.answerability.clarify_first_required && items.length === 0) {
    items.push({
      question: "Which IRS form or notice are you asking about?",
      tier: "critical_now",
      reason: opts.answerability.clarify_first_reason || "Need a specific form/notice to answer accurately.",
      changes_branch: true,
      branches_affected: [],
    });
  }

  return items;
}

export function askableNow(items: NeedToKnowItem[]): NeedToKnowItem[] {
  return items.filter((q) => q.tier === "critical_now" && q.changes_branch).slice(0, 1);
}

export function deferrable(items: NeedToKnowItem[]): NeedToKnowItem[] {
  return items.filter((q) => q.tier === "soon" || q.tier === "later" || q.tier === "not_yet");
}
