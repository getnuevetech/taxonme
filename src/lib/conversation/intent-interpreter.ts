import { buildQuestionContract } from "./question-contract";
import { detectGovernmentMatter } from "./government-matter";
import type {
  ConversationIntent,
  ConversationMessageInput,
  IntentInterpretation,
  InteractionIntent,
  PipelineId,
  ResponseMode,
  WorkspaceId,
} from "./types";
import { canonicalizeResponseMode } from "./types";

function detectDomain(text: string): string {
  if (/\b(levy|lien|collection|garnish|acs|revenue officer)\b/i.test(text)) return "tax_collection";
  if (/\b(irs|tax|cp\s?-?\d+|lt\s?-?\d+|offer in compromise|installment agreement|1040|w-?2|1099)\b/i.test(text)) {
    return "tax_general";
  }
  if (/\b(audit|examination|cp\s?-?2000)\b/i.test(text)) return "tax_exam";
  if (/\b(state\s+tax|dor|franchise tax)\b/i.test(text)) return "state_tax";
  return "general";
}

function detectConversationIntent(text: string, contractTarget: string): ConversationIntent {
  if (contractTarget === "comprehensive_case_strategy") return "comprehensive_case_review";
  if (contractTarget === "explain_document_or_notice") return "document_interpretation";
  if (contractTarget === "document_checklist") return "procedural";
  if (contractTarget === "identify_available_pathways") return "personal_eligibility";
  if (contractTarget === "petition_eligibility_overview") return "personal_eligibility";
  if (contractTarget === "status_guidance") return "status_update";
  if (contractTarget === "risk_overview") return "risk";
  if (contractTarget === "interpret_situation_offer_next_step") return "information_only";
  if (/\b(compare|versus|vs\.?|which (is|path) better)\b/i.test(text)) return "strategy_comparison";
  if (/\b(should i|what (do|should) i (do|file)|next step)\b/i.test(text)) return "take_action";
  if (/\b(what is|define|explain)\b/i.test(text)) return "general_legal";
  return "procedural";
}

function toInteractionIntent(primary: ConversationIntent): InteractionIntent {
  switch (primary) {
    case "document_interpretation":
      return "document_question";
    case "status_update":
      return "status_question";
    case "personal_eligibility":
    case "strategy_comparison":
    case "risk":
      return "personal_question";
    case "comprehensive_case_review":
    case "take_action":
      return "strategy_question";
    case "information_only":
      return "information_only";
    case "general_legal":
    case "procedural":
    default:
      return "general_question";
  }
}

/**
 * Semantic interpreter — emits recommendations only.
 * ConversationRouter makes binding workspace + engine decisions.
 * Workspace ≠ analysis depth: existing_case does not imply case_review.
 */
export function interpretIntent(input: ConversationMessageInput): IntentInterpretation {
  const contract = buildQuestionContract(input);
  const text = [input.message, input.goal].filter(Boolean).join("\n");
  const primary = detectConversationIntent(text, contract.decision_target);
  const interaction_intent = toInteractionIntent(primary);
  const domain = detectDomain(text);
  const matter = detectGovernmentMatter(text, input.documentHints);

  let recommended_response_mode: ResponseMode = "answer_then_targeted_question";
  let recommended_workspace: WorkspaceId = "question_only";
  let routing_confidence = 0.82;

  // Personalized options / eligibility → Situation (not Case).
  if (
    contract.decision_target === "identify_available_pathways" ||
    contract.decision_target === "petition_eligibility_overview" ||
    primary === "personal_eligibility"
  ) {
    recommended_workspace = "situation";
    recommended_response_mode = "answer_then_targeted_question";
    routing_confidence = 0.9;
  } else if (primary === "document_interpretation") {
    recommended_workspace = matter.existing_government_case ? "existing_case" : "question_only";
    recommended_response_mode = input.documentCount || text.length > 40 ? "answer" : "document_needed";
    routing_confidence = 0.9;
  } else if (primary === "status_update") {
    recommended_workspace = matter.existing_government_case ? "existing_case" : "question_only";
    recommended_response_mode = "answer";
    routing_confidence = 0.88;
  } else if (primary === "general_legal" || primary === "procedural") {
    recommended_workspace = "question_only";
    recommended_response_mode = "answer";
    routing_confidence = 0.88;
  } else if (primary === "information_only") {
    recommended_workspace = text.length >= 40 ? "situation" : "question_only";
    recommended_response_mode = "answer_then_targeted_question";
    routing_confidence = 0.75;
  } else if (primary === "strategy_comparison") {
    recommended_workspace = "situation";
    recommended_response_mode = "answer_then_targeted_question";
    routing_confidence = 0.86;
  } else if (primary === "comprehensive_case_review" || contract.requires_case_development) {
    if (matter.existing_government_case) {
      recommended_workspace = "existing_case";
      recommended_response_mode = "case_review";
      routing_confidence = 0.94;
    } else {
      // Unfiled “full strategy” stays Situation — do not invent a Case.
      recommended_workspace = "situation";
      recommended_response_mode = "answer_then_targeted_question";
      routing_confidence = 0.85;
    }
  } else if (primary === "take_action") {
    recommended_workspace = matter.existing_government_case ? "existing_case" : "situation";
    recommended_response_mode = matter.existing_government_case ? "answer" : "answer_then_targeted_question";
    routing_confidence = 0.8;
  }

  // Admin/diagnostic override only.
  if (input.forceCase && matter.existing_government_case) {
    recommended_workspace = "existing_case";
    recommended_response_mode = "case_review";
    routing_confidence = 0.95;
  } else if (input.forceCase && !matter.existing_government_case) {
    // Still do not auto-create Case machinery for unfiled narratives.
    recommended_workspace = "situation";
    recommended_response_mode = "answer_then_targeted_question";
    routing_confidence = 0.7;
  }

  if (matter.existing_government_case && recommended_workspace === "question_only") {
    recommended_workspace = "existing_case";
  }

  // Upload alone never bumps to case_review.
  if ((input.documentCount ?? 0) > 0 && recommended_response_mode !== "case_review") {
    routing_confidence = Math.max(routing_confidence, 0.88);
  }

  const recommended_pipeline: PipelineId =
    canonicalizeResponseMode(recommended_response_mode) === "case_review" ? "case" : "assistant";

  return {
    primary_intent: primary,
    interaction_intent,
    domain,
    question: contract.interpreted_question || contract.explicit_question || text.slice(0, 200),
    recommended_pipeline,
    recommended_response_mode,
    recommended_workspace,
    routing_confidence,
    can_answer_partially_now: canonicalizeResponseMode(recommended_response_mode) !== "document_needed",
    requires_personalized_analysis:
      primary === "personal_eligibility" || recommended_workspace === "situation",
  };
}
