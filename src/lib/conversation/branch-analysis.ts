import type { AnswerBranch, NeedToKnowItem, QuestionContract } from "./types";
import { canSurfaceResolutionPathways } from "./pathway-eligibility";

/** Evidence-first branches when debt is alleged but amount/position is unknown. */
function evidenceFirstBranches(): AnswerBranch[] {
  return [
    {
      id: "establish_account_position",
      condition: "If you do not yet know what the IRS shows",
      explanation:
        "Start with your IRS Account Transcript (or the notice stating the balance). That establishes tax years, current balance, and recent activity before any payment or relief pathway is sized.",
    },
    {
      id: "use_existing_notice",
      condition: "If you already have an IRS notice or letter",
      explanation:
        "Upload or identify the notice code (for example CP14, CP501, CP503, CP504, LT11, Letter 3172). The notice’s printed amount and deadline usually set the next move.",
    },
  ];
}

function resolutionPathwayBranches(): AnswerBranch[] {
  return [
    {
      id: "installment_agreement",
      condition: "If you can pay over time",
      explanation:
        "You may request an IRS installment agreement (often Form 9465) once the balance and tax periods are confirmed. Confirm the amount on transcript before proposing a monthly payment.",
    },
    {
      id: "currently_not_collectible",
      condition: "If you cannot pay anything right now",
      explanation:
        "You may qualify for Currently Not Collectible status when ability-to-pay shows you cannot cover allowable living expenses and still pay the IRS — collections may pause while interest can still accrue. A full Form 433 / CIS is only when the IRS requests that depth — not the first step.",
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
        "Some penalties may qualify for administrative or reasonable-cause relief depending on the tax period and compliance history — evaluated after the periods and penalty types are known.",
    },
  ];
}

/** Tax pathway / notice branches before clarify (Wave 4 + Package H honesty). */
export function analyzeBranches(opts: {
  contract: QuestionContract;
  message: string;
  askNow?: NeedToKnowItem[];
}): { branch_before_clarify: boolean; branches: AnswerBranch[] } {
  const text = `${opts.message}\n${opts.contract.interpreted_question}`;
  const lower = text.toLowerCase();
  let branches: AnswerBranch[] = [];

  const wantsPathways =
    opts.contract.decision_target === "identify_available_pathways" ||
    /\b(can'?t pay|cannot pay|owe|balance due|payment plan|installment|offer in compromise|penalty|options?|pathways?)\b/i.test(
      lower,
    );

  if (wantsPathways) {
    // Package H: thin debt talk → evidence asks, not installment/CNC/OIC menu.
    branches = canSurfaceResolutionPathways(text) ? resolutionPathwayBranches() : evidenceFirstBranches();
  } else if (
    opts.contract.decision_target === "explain_document_or_notice" ||
    /\bcp\s?-?\d+|lt\s?-?\d+|notice\b/i.test(lower)
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
  } else if (/\bspouse|married|joint return|dependent\b/i.test(lower)) {
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
