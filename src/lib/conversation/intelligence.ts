import { evaluateAnswerability } from "./answerability";
import { routeConversation } from "./conversation-router";
import { detectGovernmentMatter } from "./government-matter";
import { interpretIntent } from "./intent-interpreter";
import { buildExperienceRecord, buildLearningEvent } from "@/lib/experience";
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
    existingGovernmentCase: route.existing_government_case,
    interactionIntent: intent.interaction_intent,
    pathways: strategy.branches.map((b) => b.id),
    askNow: strategy.ask_now,
    needToKnow: need_to_know,
    message,
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

export type EnrichIntelligenceOptions = {
  /** Skip live DB experience search (tests). */
  experienceHints?: import("./intelligence-enrich").ExperienceAskHints | null;
  /** Injectable contract refine (tests / no provider). */
  refineContract?: (
    intel: ConversationIntelligence,
    input: ConversationMessageInput,
  ) => Promise<import("./intelligence-enrich").ContractRefinePatch | null>;
  /** Force / skip model attempt regardless of confidence. */
  attemptModelRefine?: boolean;
};

/**
 * Optional enrichment when heuristic confidence is low or experience patterns apply.
 * Never invents document facts; only may reorder existing asks and refine
 * interpreted_question / decision_target labels (allowlisted).
 * Fail-closed: any error or missing provider returns intel unchanged (after safe hint apply).
 */
export async function enrichIntelligenceWithReasoningModel(
  intel: ConversationIntelligence,
  input: ConversationMessageInput,
  options: EnrichIntelligenceOptions = {},
): Promise<ConversationIntelligence> {
  const {
    applyExperienceAskHints,
    applyContractRefine,
  } = await import("./intelligence-enrich");
  const { shouldAttemptReasoningEnrichment, MODEL_ROLES, ROLE_CAPABILITIES } = await import(
    "@/lib/ai/model-capabilities"
  );

  let next = intel;

  try {
    let hints = options.experienceHints;
    if (hints === undefined) {
      try {
        const { searchProductionExperience, productionPatternAskHints } = await import(
          "@/lib/experience/search"
        );
        const { extractSituationFeatures } = await import("@/lib/experience/what-mattered");
        const message = String(input.message ?? "");
        const hits = await searchProductionExperience({
          decisionTarget: next.question_contract.decision_target,
          workspace: next.route.workspace,
          factKeys: extractSituationFeatures(message),
          pathways: next.strategy.branches.map((b) => b.id),
          limit: 5,
        });
        hints = productionPatternAskHints(hits);
      } catch {
        hints = null;
      }
    }
    if (hints) next = applyExperienceAskHints(next, hints);
  } catch {
    // Experience apply must never break the turn.
  }

  const attemptModel =
    options.attemptModelRefine ??
    shouldAttemptReasoningEnrichment({
      routing_confidence: next.intent.routing_confidence,
      clarify_first_required: next.answerability.clarify_first_required,
    });

  if (!attemptModel) return next;
  if (!ROLE_CAPABILITIES[MODEL_ROLES.PRIMARY_REASONING].may_refine_contract) return next;

  try {
    const patch =
      options.refineContract != null
        ? await options.refineContract(next, input)
        : await defaultPrimaryReasoningRefine(next, input);
    if (patch) next = applyContractRefine(next, patch);
  } catch {
    // Fail closed: keep heuristic (+ experience) result.
  }

  return next;
}

async function defaultPrimaryReasoningRefine(
  intel: ConversationIntelligence,
  input: ConversationMessageInput,
): Promise<import("./intelligence-enrich").ContractRefinePatch | null> {
  const { parseContractRefineResponse } = await import("./intelligence-enrich");
  const { ALLOWED_DECISION_TARGETS } = await import("@/lib/ai/model-capabilities");

  // Dynamic import keeps this module importable from client bundles that only use sync helpers.
  const { db } = await import("@/lib/db");
  const { providerAllowedForTaxData } = await import("@/lib/ai/provider-policy");
  const { callProvider } = await import("@/lib/ai/adapters");

  const providers = await db.aiProvider.findMany({
    where: { isEnabled: true },
    orderBy: [{ costTier: "desc" }, { name: "asc" }],
    take: 12,
  });
  const provider = providers.find((p) => providerAllowedForTaxData(p));
  if (!provider) return null;

  const system = [
    "You refine TaxOnMe conversation question contracts.",
    "Return ONLY JSON: {\"interpreted_question\":\"...\",\"decision_target\":\"...\"}.",
    `decision_target must be one of: ${ALLOWED_DECISION_TARGETS.join(", ")}.`,
    "Do not invent documents, balances, notice codes, or legal conclusions.",
    "Only clarify what the user is asking and the decision target label.",
  ].join(" ");

  const user = JSON.stringify({
    message: String(input.message ?? "").slice(0, 2000),
    goal: String(input.goal ?? "").slice(0, 400),
    current: {
      interpreted_question: intel.question_contract.interpreted_question,
      decision_target: intel.question_contract.decision_target,
      routing_confidence: intel.intent.routing_confidence,
    },
  });

  const result = await callProvider(provider, [
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  return parseContractRefineResponse(result.text);
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
