import type { Answerability, IntentInterpretation, QuestionContract, ResponseMode } from "./types";

/**
 * Answerability engine. clarify_first is rare and must be justified.
 */
export function evaluateAnswerability(opts: {
  contract: QuestionContract;
  intent: IntentInterpretation;
  message: string;
  documentCount?: number;
}): Answerability {
  const { contract, intent, message, documentCount = 0 } = opts;
  const text = message.trim();

  // Rare: cannot even identify the proceeding / form the user refers to.
  if (/\b(form x|this form|that notice|the letter)\b/i.test(text) && text.length < 80 && documentCount === 0) {
    return {
      fully_answerable: false,
      partially_answerable: false,
      requires_clarification: true,
      requires_document: false,
      clarify_first_required: true,
      clarify_first_reason: "Any substantive answer would depend entirely on unresolved identity of the form or notice.",
    };
  }

  if (contract.decision_target === "explain_document_or_notice" && documentCount === 0 && !/\b(cp\s?-?\d+|lt\s?-?\d+|irs\s+notice|levy|lien)\b/i.test(text)) {
    return {
      fully_answerable: false,
      partially_answerable: false,
      requires_clarification: false,
      requires_document: true,
      clarify_first_required: false,
      clarify_first_reason: "",
    };
  }

  if (intent.recommended_response_mode === "answer" || contract.decision_target === "document_checklist") {
    return {
      fully_answerable: true,
      partially_answerable: true,
      requires_clarification: false,
      requires_document: false,
      clarify_first_required: false,
      clarify_first_reason: "",
    };
  }

  if (contract.decision_target === "identify_available_pathways" || contract.decision_target === "petition_eligibility_overview") {
    return {
      fully_answerable: false,
      partially_answerable: true,
      requires_clarification: true,
      requires_document: false,
      clarify_first_required: false,
      clarify_first_reason: "",
    };
  }

  if (contract.requires_case_development) {
    return {
      fully_answerable: false,
      partially_answerable: true,
      requires_clarification: true,
      requires_document: false,
      clarify_first_required: false,
      clarify_first_reason: "",
    };
  }

  return {
    fully_answerable: intent.can_answer_partially_now && !intent.requires_personalized_analysis,
    partially_answerable: true,
    requires_clarification: intent.recommended_response_mode === "answer_then_targeted_questions",
    requires_document: false,
    clarify_first_required: false,
    clarify_first_reason: "",
  };
}

export function responseModeFromAnswerability(
  answerability: Answerability,
  recommended: ResponseMode,
  requiresCase: boolean,
): ResponseMode {
  // requiresCase here means "contract asked for comprehensive development" —
  // callers must only pass true when a government matter exists (see router).
  if (requiresCase) return "case_review";
  if (answerability.clarify_first_required) return "clarify_first";
  if (answerability.requires_document) return "document_needed";
  if (answerability.fully_answerable) return "answer";
  if (answerability.partially_answerable) {
    return recommended === "answer" ? "answer" : "answer_then_targeted_question";
  }
  return recommended;
}
