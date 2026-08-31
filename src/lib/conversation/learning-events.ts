/**
 * Local learning-event helpers (Wave 4). Full Experience L0–L7 lands in Wave 7.
 */
import type {
  ConversationIntelligence,
  InteractionIntent,
  LearningEvent,
  NeedToKnowItem,
  QuestionContract,
  ResponseMode,
  WorkspaceId,
} from "./types";

export function buildLearningEvent(input: {
  contract: QuestionContract;
  workspace: WorkspaceId;
  responseMode: ResponseMode;
  invokesCaseEngine: boolean;
  existingGovernmentCase: boolean;
  interactionIntent: InteractionIntent;
  pathways: string[];
  askNow: NeedToKnowItem[];
  needToKnow: NeedToKnowItem[];
}): LearningEvent {
  const ask = input.askNow[0] ?? null;
  const suppressed = input.needToKnow
    .filter((q) => q.tier === "later" || q.tier === "not_yet")
    .map((q) => q.question);
  return {
    question_contract: input.contract,
    workspace_selected: input.workspace,
    decision_target: input.contract.decision_target,
    pathways_considered: input.pathways,
    clarification_selected: ask?.question ?? null,
    clarification_reason: ask?.reason ?? null,
    questions_suppressed: suppressed,
    response_mode: input.responseMode,
    invokes_case_engine: input.invokesCaseEngine,
    existing_government_case: input.existingGovernmentCase,
    interaction_intent: input.interactionIntent,
  };
}

export function learningEventFromIntelligence(intel: ConversationIntelligence): LearningEvent {
  return intel.learning_event;
}

export function assertNoPrematureSchemaAsk(intel: ConversationIntelligence): boolean {
  return !intel.strategy.ask_now.some((q) => /schema|every field|complete profile/i.test(q.question));
}

export function buildExperienceRecord(input: {
  contract: QuestionContract;
  workspace: WorkspaceId;
  responseMode: ResponseMode;
  existingGovernmentCase: boolean;
  interactionIntent: InteractionIntent;
  pathways: string[];
  askNow: NeedToKnowItem[];
  needToKnow: NeedToKnowItem[];
  message: string;
  documentsUsed: string[];
}): Record<string, unknown> {
  return {
    version: "wave4-stub",
    decision_target: input.contract.decision_target,
    workspace: input.workspace,
    response_mode: input.responseMode,
    existing_government_case: input.existingGovernmentCase,
    interaction_intent: input.interactionIntent,
    pathways: input.pathways,
    ask_now: input.askNow.map((q) => q.question),
    documents_used: input.documentsUsed,
    decision_changing_facts: [],
    negative_lesson_ids: [],
  };
}

export function learningEventFromExperience(
  experience: Record<string, unknown>,
  fallback?: LearningEvent,
): LearningEvent {
  if (fallback) return fallback;
  return {
    question_contract: (experience.question_contract as QuestionContract) ?? {
      explicit_question: "",
      interpreted_question: "",
      decision_target: String(experience.decision_target ?? "understand_user_request"),
      current_scope: "general",
      user_requested_action: false,
      requires_case_development: false,
    },
    workspace_selected: (experience.workspace as WorkspaceId) ?? "question_only",
    decision_target: String(experience.decision_target ?? "understand_user_request"),
    pathways_considered: Array.isArray(experience.pathways) ? (experience.pathways as string[]) : [],
    clarification_selected: null,
    clarification_reason: null,
    questions_suppressed: [],
    response_mode: (experience.response_mode as ResponseMode) ?? "answer",
    invokes_case_engine: false,
    existing_government_case: Boolean(experience.existing_government_case),
    interaction_intent: (experience.interaction_intent as InteractionIntent) ?? "general_question",
  };
}
