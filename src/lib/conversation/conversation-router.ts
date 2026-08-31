import { detectGovernmentMatter } from "./government-matter";
import type {
  Answerability,
  ConversationRoute,
  IntentInterpretation,
  PipelineId,
  QuestionContract,
  ResponseMode,
  ResponseStrategy,
  WorkspaceId,
} from "./types";
import { canonicalizeResponseMode, invokesCaseEngine } from "./types";

export type RouterInput = {
  contract: QuestionContract;
  intent: IntentInterpretation;
  answerability: Answerability;
  strategy: ResponseStrategy;
  message?: string;
  documentCount?: number;
  documentHints?: string[];
  /** Internal/admin diagnostic only. */
  forceCase?: boolean;
};

/**
 * Conversation Router — sole authority for workspace + whether V5.1 runs.
 *
 * Locked rule: workspace / existing_case NEVER alone invokes the Case engine.
 * response_mode (canonical) determines invokes_case_engine.
 */
export function routeConversation(input: RouterInput): ConversationRoute {
  const matter = detectGovernmentMatter(
    [input.message ?? "", input.contract.explicit_question, input.contract.interpreted_question].join("\n"),
    input.documentHints,
  );

  let workspace: WorkspaceId = input.intent.recommended_workspace;
  let responseMode: ResponseMode = canonicalizeResponseMode(
    input.strategy.mode || input.intent.recommended_response_mode,
  );

  if (matter.existing_government_case && workspace === "question_only") {
    workspace = "existing_case";
  }

  // Explicit unfiled pathway questions stay Situation even if noisy cues appear.
  if (
    (input.contract.decision_target === "identify_available_pathways" ||
      input.contract.decision_target === "petition_eligibility_overview") &&
    !matter.existing_government_case
  ) {
    workspace = "situation";
    if (responseMode === "case_review" || responseMode === "initiate_case") {
      responseMode = "answer_then_targeted_question";
    }
  }

  // Admin override: only elevates to case_review when a government matter exists.
  if (input.forceCase && matter.existing_government_case) {
    workspace = "existing_case";
    responseMode = "case_review";
  }

  // Document explain on an existing matter → answer, not case_review.
  if (
    workspace === "existing_case" &&
    input.contract.decision_target === "explain_document_or_notice" &&
    responseMode === "case_review"
  ) {
    responseMode = "answer";
  }

  const docs = input.documentCount ?? 0;
  if (docs > 0 && responseMode === "case_review" && !input.contract.requires_case_development && !input.forceCase) {
    // Upload alone never selects case engine.
    responseMode =
      input.contract.decision_target === "explain_document_or_notice" ? "answer" : "answer_then_targeted_question";
  }

  responseMode = canonicalizeResponseMode(responseMode);
  const caseEngine = invokesCaseEngine(responseMode);
  const pipeline: PipelineId = caseEngine ? "case" : "assistant";

  return {
    pipeline,
    workspace,
    customer_state: workspace,
    response_mode: responseMode,
    existing_government_case: matter.existing_government_case,
    invokes_case_engine: caseEngine,
    reason: caseEngine
      ? "response_mode=case_review: invoke V5.1 Case engine for this turn."
      : `workspace=${workspace}; response_mode=${responseMode}; Case engine not invoked (workspace alone never triggers V5.1).`,
    from_recommendation: input.intent.recommended_pipeline,
    confidence: input.intent.routing_confidence,
  };
}

/** Promotion to Case engine: never from upload alone; never from workspace alone. */
export function mayPromoteAssistantToCase(opts: {
  contract: QuestionContract;
  userExplicitlyRequestsCase: boolean;
  documentCount?: number;
  existingGovernmentCase?: boolean;
  responseMode?: ResponseMode;
}): { allowed: boolean; reason: string } {
  if ((opts.documentCount ?? 0) > 0 && !opts.userExplicitlyRequestsCase) {
    return { allowed: false, reason: "Document upload alone must never trigger A→B promotion." };
  }
  if (opts.responseMode && invokesCaseEngine(opts.responseMode)) {
    return { allowed: true, reason: "response_mode=case_review." };
  }
  if (opts.userExplicitlyRequestsCase && opts.existingGovernmentCase) {
    return { allowed: true, reason: "Explicit request with existing government matter." };
  }
  if (opts.userExplicitlyRequestsCase && !opts.existingGovernmentCase) {
    return {
      allowed: false,
      reason: "Explicit review without an agency matter stays Situation / Prep Plan — not Case.",
    };
  }
  if (opts.contract.requires_case_development && opts.existingGovernmentCase) {
    return { allowed: true, reason: "Case-development contract with government matter." };
  }
  return { allowed: false, reason: "No case_review signal; workspace alone is insufficient." };
}
