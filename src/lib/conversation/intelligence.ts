import { evaluateAnswerability } from "./answerability";
import { routeConversation } from "./conversation-router";
import { detectGovernmentMatter } from "./government-matter";
import { interpretIntent } from "./intent-interpreter";
import { buildExperienceRecord, buildLearningEvent } from "./learning-events";
import { buildNeedToKnow } from "./need-to-know";
import { buildQuestionContract } from "./question-contract";
import { buildResponseStrategy } from "./response-strategy";
import type { ConversationIntelligence, ConversationMessageInput, QuestionContract } from "./types";

/** Full Phase −1 / Phase S pipeline: contract → intent → answerability → need-to-know → strategy → router → learning event. */
export function runConversationIntelligence(input: ConversationMessageInput): ConversationIntelligence {
  const message = String(input.message ?? "").trim();
  const question_contract = buildQuestionContract(input);
  const intent = interpretIntent({ ...input });
  intent.question = question_contract.interpreted_question || intent.question;
  const answerability = evaluateAnswerability({
    contract: question_contract,
    intent,
    message,
    documentCount: input.documentCount,
  });
  const need_to_know = buildNeedToKnow({
    contract: question_contract,
    message,
    answerability,
  });
  const matter = detectGovernmentMatter([message, input.goal ?? ""].join("\n"), input.documentHints);
  const strategy = buildResponseStrategy({
    contract: question_contract,
    intent,
    answerability,
    needToKnow: need_to_know,
    message,
    allowCaseReview: matter.existing_government_case,
  });
  const route = routeConversation({
    contract: question_contract,
    intent,
    answerability,
    strategy,
    message,
    documentCount: input.documentCount,
    documentHints: input.documentHints,
    forceCase: input.forceCase,
  });

  strategy.mode = route.response_mode;

  const experience_record = buildExperienceRecord({
    contract: question_contract,
    workspace: route.workspace,
    responseMode: route.response_mode,
    existingGovernmentCase: route.existing_government_case,
    interactionIntent: intent.interaction_intent,
    pathways: strategy.branches.map((b) => b.id),
    askNow: strategy.ask_now,
    needToKnow: need_to_know,
    message,
    documentsUsed: input.documentHints ?? [],
  });
  const learning_event = buildLearningEvent({
    contract: question_contract,
    workspace: route.workspace,
    responseMode: route.response_mode,
    invokesCaseEngine: route.invokes_case_engine,
    existingGovernmentCase: route.existing_government_case,
    interactionIntent: intent.interaction_intent,
    pathways: strategy.branches.map((b) => b.id),
    askNow: strategy.ask_now,
    needToKnow: need_to_know,
  });

  return {
    question_contract,
    intent,
    answerability,
    need_to_know,
    strategy,
    route,
    learning_event,
    experience_record,
  };
}

export function parseStoredIntelligence(raw: string | null | undefined): ConversationIntelligence | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ConversationIntelligence;
    if (!parsed?.question_contract?.decision_target) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function priorContractFromStored(raw: string | null | undefined): QuestionContract | null {
  return parseStoredIntelligence(raw)?.question_contract ?? null;
}

/**
 * Optional Sol enrichment when heuristic confidence is low.
 * Never invents document facts; only may refine interpreted_question / decision_target labels.
 * Falls back silently when no PRIMARY_REASONING provider/key is available.
 */
/**
 * Optional model refinement of low-confidence contracts.
 * Wave 4: no-op until TaxOnMe ports model-capabilities + experience search (Waves 6–7).
 */
export async function enrichIntelligenceWithReasoningModel(
  intel: ConversationIntelligence,
  _input: ConversationMessageInput,
): Promise<ConversationIntelligence> {
  return intel;
}

export function isQuestionShapedCaseNarrative(situation: string, goal: string): boolean {
  const intel = runConversationIntelligence({ message: situation, goal });
  return (
    !intel.route.invokes_case_engine &&
    !intel.answerability.clarify_first_required &&
    (intel.strategy.provisional_answer_outline.length > 0 || intel.strategy.branches.length > 0)
  );
}

export function caseMustAnswerBeforeClarify(situation: string, goal: string): boolean {
  const intel = runConversationIntelligence({ message: situation, goal });
  if (intel.answerability.clarify_first_required) return false;
  return isQuestionShapedCaseNarrative(situation, goal) || !intel.route.invokes_case_engine;
}
