/**
 * Phase −1 / Phase S Conversation Intelligence — domain-neutral types.
 * Workspace state never determines analysis depth; response_mode does.
 */

export const INTERACTION_INTENTS = [
  "general_question",
  "personal_question",
  "document_question",
  "status_question",
  "strategy_question",
  "action_request",
  "information_only",
] as const;

export type InteractionIntent = (typeof INTERACTION_INTENTS)[number];

/** @deprecated Prefer InteractionIntent; kept for stored snapshots. */
export const CONVERSATION_INTENTS = [
  "general_legal",
  "personal_eligibility",
  "procedural",
  "document_interpretation",
  "strategy_comparison",
  "status_update",
  "risk",
  "take_action",
  "information_only",
  "comprehensive_case_review",
] as const;

export type ConversationIntent = (typeof CONVERSATION_INTENTS)[number];

export const CUSTOMER_STATES = ["question_only", "situation", "filing_plan", "existing_case"] as const;
export type CustomerState = (typeof CUSTOMER_STATES)[number];

export const WORKSPACES = CUSTOMER_STATES;
export type WorkspaceId = CustomerState;

export const RESPONSE_MODES = [
  "answer",
  "answer_then_targeted_question",
  "answer_then_targeted_questions", // legacy alias
  "clarify_first",
  "document_needed",
  "request_document", // legacy alias
  "filing_plan_build",
  "case_review",
  "initiate_case", // legacy alias → case_review
] as const;

export type ResponseMode = (typeof RESPONSE_MODES)[number];

/** Legacy binary pipeline — derived from response_mode, not workspace. */
export const PIPELINE_IDS = ["assistant", "case"] as const;
export type PipelineId = (typeof PIPELINE_IDS)[number];

export const NEED_TO_KNOW_TIERS = ["critical_now", "soon", "later", "not_yet"] as const;
export type NeedToKnowTier = (typeof NEED_TO_KNOW_TIERS)[number];

export type QuestionContract = {
  explicit_question: string;
  interpreted_question: string;
  decision_target: string;
  current_scope: string;
  user_requested_action: boolean;
  requires_case_development: boolean;
};

export type Answerability = {
  fully_answerable: boolean;
  partially_answerable: boolean;
  requires_clarification: boolean;
  requires_document: boolean;
  clarify_first_required: boolean;
  clarify_first_reason: string;
};

export type NeedToKnowItem = {
  question: string;
  tier: NeedToKnowTier;
  reason: string;
  changes_branch: boolean;
  branches_affected: string[];
};

export type AnswerBranch = {
  id: string;
  condition: string;
  explanation: string;
};

export type IntentInterpretation = {
  primary_intent: ConversationIntent;
  interaction_intent: InteractionIntent;
  domain: string;
  question: string;
  recommended_pipeline: PipelineId;
  recommended_response_mode: ResponseMode;
  recommended_workspace: WorkspaceId;
  routing_confidence: number;
  can_answer_partially_now: boolean;
  requires_personalized_analysis: boolean;
};

export type ResponseStrategy = {
  mode: ResponseMode;
  branch_before_clarify: boolean;
  branches: AnswerBranch[];
  ask_now: NeedToKnowItem[];
  ask_later: NeedToKnowItem[];
  provisional_answer_outline: string[];
};

export type ConversationRoute = {
  /** Derived: case only when response_mode invokes V5.1 — never from workspace alone. */
  pipeline: PipelineId;
  workspace: WorkspaceId;
  customer_state: CustomerState;
  response_mode: ResponseMode;
  existing_government_case: boolean;
  invokes_case_engine: boolean;
  reason: string;
  from_recommendation: PipelineId;
  confidence: number;
};

export type ConversationIntelligence = {
  question_contract: QuestionContract;
  intent: IntentInterpretation;
  answerability: Answerability;
  need_to_know: NeedToKnowItem[];
  strategy: ResponseStrategy;
  route: ConversationRoute;
  learning_event: LearningEvent;
  /** L0 full experience capture (Phase −1.9); retrieval gated until L4. */
  experience_record?: Record<string, unknown>;
};

export type LearningEvent = {
  question_contract: QuestionContract;
  workspace_selected: WorkspaceId;
  decision_target: string;
  pathways_considered: string[];
  clarification_selected: string | null;
  clarification_reason: string | null;
  questions_suppressed: string[];
  response_mode: ResponseMode;
  invokes_case_engine: boolean;
  existing_government_case: boolean;
  interaction_intent: InteractionIntent;
};

export type ConversationMessageInput = {
  message: string;
  goal?: string | null;
  history?: { role: string; content: string }[];
  documentCount?: number;
  documentHints?: string[];
  /** Internal/admin diagnostic only — never a customer pipeline picker. */
  forceCase?: boolean;
  priorContract?: QuestionContract | null;
};

export function emptyQuestionContract(): QuestionContract {
  return {
    explicit_question: "",
    interpreted_question: "",
    decision_target: "understand_user_request",
    current_scope: "general",
    user_requested_action: false,
    requires_case_development: false,
  };
}

/** Normalize legacy / alias response modes to canonical S0 modes. */
export function canonicalizeResponseMode(mode: ResponseMode): ResponseMode {
  if (mode === "initiate_case") return "case_review";
  if (mode === "request_document") return "document_needed";
  if (mode === "answer_then_targeted_questions") return "answer_then_targeted_question";
  return mode;
}

export function invokesCaseEngine(mode: ResponseMode): boolean {
  const m = canonicalizeResponseMode(mode);
  return m === "case_review";
}
