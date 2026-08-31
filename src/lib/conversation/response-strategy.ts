import { responseModeFromAnswerability } from "./answerability";
import { analyzeBranches } from "./branch-analysis";
import { askableNow, deferrable } from "./need-to-know";
import type {
  Answerability,
  IntentInterpretation,
  NeedToKnowItem,
  QuestionContract,
  ResponseStrategy,
} from "./types";

export function buildResponseStrategy(opts: {
  contract: QuestionContract;
  intent: IntentInterpretation;
  answerability: Answerability;
  needToKnow: NeedToKnowItem[];
  message: string;
  /** Only true when government matter exists AND strategy review is requested. */
  allowCaseReview?: boolean;
}): ResponseStrategy {
  const mode = responseModeFromAnswerability(
    opts.answerability,
    opts.intent.recommended_response_mode,
    Boolean(opts.allowCaseReview && opts.contract.requires_case_development),
  );
  const ask_now =
    mode === "clarify_first" || mode === "case_review" || mode === "initiate_case" ? [] : askableNow(opts.needToKnow);
  const ask_later = deferrable(opts.needToKnow);
  const { branch_before_clarify, branches } = analyzeBranches({
    contract: opts.contract,
    message: opts.message,
    askNow: ask_now,
  });

  const provisional_answer_outline = outlineFor(opts.contract, branches, mode);

  // BRANCH_BEFORE_CLARIFY: never clear ask_now when we can show branches — ask after.
  return {
    mode,
    branch_before_clarify: branch_before_clarify && mode !== "clarify_first",
    branches,
    ask_now: mode === "answer" ? [] : ask_now,
    ask_later,
    provisional_answer_outline,
  };
}

function outlineFor(
  contract: QuestionContract,
  branches: { condition: string; explanation: string }[],
  mode: ResponseStrategy["mode"],
): string[] {
  if (mode === "case_review" || mode === "initiate_case") {
    return ["Run agency-matter case review: notices on record, balances, risks, and next actions."];
  }
  if (mode === "document_needed" || mode === "request_document") {
    return ["Ask for the notice/document (or its form number) before explaining it."];
  }
  if (mode === "clarify_first") {
    return ["Clarify the identity of the form/notice before giving substantive guidance."];
  }
  if (branches.length) {
    return [
      "Explain the main legally meaningful branches for the current decision target.",
      ...branches.map((b) => `${b.condition}: ${b.explanation}`),
      "Then ask only the critical fact that chooses among those branches.",
    ];
  }
  if (contract.decision_target === "explain_document_or_notice") {
    return ["Explain what the named notice/form is and what it usually means next."];
  }
  if (contract.decision_target === "document_checklist") {
    return ["List typical documents for the stated filing goal without demanding uploads first."];
  }
  return ["Answer the interpreted question with official-material framing, then ask only decision-changing facts."];
}
