import type { AnswerBranch, NeedToKnowItem, QuestionContract } from "./types";

/** Tax pathway / notice branches before clarify (Wave 4). */
export function analyzeBranches(opts: {
  contract: QuestionContract;
  message: string;
  askNow?: NeedToKnowItem[];
}): { branch_before_clarify: boolean; branches: AnswerBranch[] } {
  const text = `${opts.message}\n${opts.contract.interpreted_question}`.toLowerCase();
  let branches: AnswerBranch[] = [];

  if (
    opts.contract.decision_target === "identify_available_pathways" ||
    /\b(can'?t pay|cannot pay|owe|balance due|payment plan|installment|offer in compromise|penalty)\b/i.test(text)
  ) {
    branches = [
      {
        id: "installment_agreement",
        condition: "If you can pay over time",
        explanation:
          "Many taxpayers set up an IRS installment agreement (for example Form 9465). Streamlined options often apply under common balance thresholds.",
      },
      {
        id: "currently_not_collectible",
        condition: "If you cannot pay anything right now",
        explanation:
          "You may qualify to be placed in Currently Not Collectible status after proving financial hardship — collections pause while interest may still accrue.",
      },
      {
        id: "offer_in_compromise",
        condition: "If you can settle for less than the full balance",
        explanation:
          "An Offer in Compromise is a formal settlement path with strict financial disclosure. It is not the first step for most people.",
      },
      {
        id: "penalty_abatement",
        condition: "If penalties are a large part of what you owe",
        explanation:
          "First-time abatement or reasonable-cause relief can reduce penalties when the facts fit IRS rules — requested in writing with supporting explanation.",
      },
    ];
  } else if (
    opts.contract.decision_target === "explain_document_or_notice" ||
    /\bcp\s?-?\d+|lt\s?-?\d+|notice\b/i.test(text)
  ) {
    branches = [
      {
        id: "respond_by_deadline",
        condition: "If the notice has a response deadline",
        explanation: "Calendar the deadline first. Late responses can trigger stronger collection steps.",
      },
      {
        id: "verify_irs_figures",
        condition: "If the amounts look wrong",
        explanation: "Compare the notice to your return, W-2/1099s, and transcripts before agreeing to any balance.",
      },
    ];
  } else if (/\bspouse|married|joint return|dependent\b/i.test(text)) {
    branches = [
      {
        id: "joint_vs_separate",
        condition: "If filing status or spouse liability is in play",
        explanation:
          "Joint returns create joint liability; innocent spouse / separation of liability relief is a separate path when facts support it.",
      },
    ];
  }

  return {
    branch_before_clarify: branches.length >= 2,
    branches,
  };
}
