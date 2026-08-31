/**
 * Phase −1.9 L0/L2 — structured turn capture.
 * Raw messages are inspected for feature keys but are never retained here.
 */
import type {
  ConversationIntelligence,
  InteractionIntent,
  LearningEvent,
  NeedToKnowItem,
  QuestionContract,
  ResponseMode,
  WorkspaceId,
} from "../conversation/types";
import {
  canonicalizeResponseMode,
  invokesCaseEngine,
} from "../conversation/types";
import {
  avoidedNegativeLessonIds,
  buildNegativeLearningRecords,
  type NegativeLearningRecord,
} from "./negative-learning";
import { TAX_RELIEF_SCHEMA_NEGATIVE_LESSON } from "./negative-lessons";
import {
  clarificationFactKey,
  partitionWhatMattered,
} from "./what-mattered";

export type ClarificationSelected = {
  key: string;
  question: string;
  reason: string;
} | null;

export type ExperienceRecordV0 = {
  schema_version: "l0";
  capture_enrichment?: "l2";
  question_contract: QuestionContract;
  workspace: WorkspaceId;
  decision_target: string;
  facts_considered: string[];
  decision_changing_facts: string[];
  facts_not_needed_yet: string[];
  facts_discarded?: string[];
  pathways_considered: string[];
  clarification_selected: ClarificationSelected;
  clarifications_suppressed: string[];
  documents_used: string[];
  authority_ids: string[];
  answer_changed_after_clarification: boolean;
  model_correction: null | { note: string };
  reviewer_correction: null | {
    origin?: "consultant_correction";
    note: string;
    failure_type?: string;
    incorrect_key?: string;
    preferred_key?: string;
    lesson_id?: string | null;
  };
  outcome: null | {
    kind: string;
    detail: string;
    government_system?: string;
    form_or_notice_key?: string;
    authority_keys?: string[];
    authority_publisher?: string;
    authority_check?: "passed" | "failed";
    signal_precedence?: "historical_experience";
  };
  response_mode: ResponseMode;
  invokes_case_engine: boolean;
  existing_government_case: boolean;
  interaction_intent: InteractionIntent;
  negative_lesson_ids: string[];
  negative_learning_records?: NegativeLearningRecord[];
};

export function buildExperienceRecord(opts: {
  contract: QuestionContract;
  workspace: WorkspaceId;
  responseMode: ResponseMode;
  existingGovernmentCase: boolean;
  interactionIntent: InteractionIntent;
  pathways: string[];
  askNow: NeedToKnowItem[];
  needToKnow?: NeedToKnowItem[];
  message?: string;
  factsConsidered?: string[];
  decisionChangingFacts?: string[];
  factsDiscarded?: string[];
  documentsUsed?: string[];
  authorityIds?: string[];
  answerChangedAfterClarification?: boolean;
}): ExperienceRecordV0 {
  const mode = canonicalizeResponseMode(opts.responseMode);
  const ask = opts.askNow[0] ?? null;
  const partitioned = partitionWhatMattered({
    message: opts.message ?? "",
    contract: opts.contract,
    askNow: opts.askNow,
    needToKnow: opts.needToKnow,
    pathways: opts.pathways,
  });
  const negative_learning_records = buildNegativeLearningRecords({
    message: opts.message ?? "",
    contract: opts.contract,
    askNow: opts.askNow,
  });
  const negativeIds = new Set(
    avoidedNegativeLessonIds(negative_learning_records),
  );
  for (const record of negative_learning_records) {
    if (record.evaluation === "violated") negativeIds.add(record.lesson_id);
  }
  if (
    opts.contract.decision_target === "identify_available_pathways" ||
    opts.contract.decision_target === "identify_possible_pathways"
  ) {
    negativeIds.add(TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id);
  }

  const facts_discarded =
    opts.factsDiscarded ?? partitioned.facts_discarded;
  const decision_changing_facts =
    opts.decisionChangingFacts ??
    (partitioned.decision_changing_facts.length
      ? partitioned.decision_changing_facts
      : ask
        ? [clarificationFactKey(ask.question)]
        : []);

  return {
    schema_version: "l0",
    capture_enrichment: "l2",
    question_contract: opts.contract,
    workspace: opts.workspace,
    decision_target: opts.contract.decision_target,
    facts_considered: opts.factsConsidered ?? partitioned.facts_considered,
    decision_changing_facts,
    facts_not_needed_yet: facts_discarded,
    facts_discarded,
    pathways_considered: opts.pathways,
    clarification_selected: ask
      ? {
          key: clarificationFactKey(ask.question),
          question: ask.question,
          reason: ask.reason,
        }
      : null,
    clarifications_suppressed: facts_discarded,
    documents_used: opts.documentsUsed ?? [],
    authority_ids: opts.authorityIds ?? [],
    answer_changed_after_clarification:
      opts.answerChangedAfterClarification ?? false,
    model_correction: null,
    reviewer_correction: null,
    outcome: null,
    response_mode: mode,
    invokes_case_engine: invokesCaseEngine(mode),
    existing_government_case: opts.existingGovernmentCase,
    interaction_intent: opts.interactionIntent,
    negative_lesson_ids: [...negativeIds],
    negative_learning_records,
  };
}

export function learningEventFromExperience(
  record: ExperienceRecordV0,
): LearningEvent {
  return {
    question_contract: record.question_contract,
    workspace_selected: record.workspace,
    decision_target: record.decision_target,
    pathways_considered: record.pathways_considered,
    clarification_selected: record.clarification_selected?.key ?? null,
    clarification_reason: record.clarification_selected?.reason ?? null,
    questions_suppressed: record.clarifications_suppressed,
    response_mode: record.response_mode,
    invokes_case_engine: record.invokes_case_engine,
    existing_government_case: record.existing_government_case,
    interaction_intent: record.interaction_intent,
  };
}

export function buildLearningEvent(opts: {
  contract: QuestionContract;
  workspace: WorkspaceId;
  responseMode: ResponseMode;
  existingGovernmentCase: boolean;
  interactionIntent: InteractionIntent;
  pathways: string[];
  askNow: NeedToKnowItem[];
  suppressed?: string[];
  message?: string;
  needToKnow?: NeedToKnowItem[];
}): LearningEvent {
  const record = buildExperienceRecord(opts);
  if (opts.suppressed?.length) {
    record.clarifications_suppressed = opts.suppressed;
    record.facts_not_needed_yet = opts.suppressed;
    record.facts_discarded = opts.suppressed;
  }
  return learningEventFromExperience(record);
}

export function learningEventFromIntelligence(
  intel: ConversationIntelligence,
): LearningEvent {
  return intel.learning_event;
}

export function assertNoPrematureSchemaAsk(
  ask: NeedToKnowItem | undefined,
  decisionTarget: string,
): boolean {
  if (
    !ask ||
    (decisionTarget !== "identify_available_pathways" &&
      decisionTarget !== "identify_possible_pathways")
  ) {
    return true;
  }
  return !/(?:form\s*433|complete financial statement|all income.{0,20}expenses.{0,20}assets)/i.test(
    ask.question,
  );
}
