/**
 * Phase −1.9 L2 — evaluate turns against institutional failure patterns.
 */
import type { NeedToKnowItem, QuestionContract } from "../conversation/types";
import {
  SEEDED_NEGATIVE_LESSONS,
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON,
  isPrematureFinancialSchemaAsk,
  type NegativeLesson,
} from "./negative-lessons";
import {
  clarificationFactKey,
  extractSituationFeatures,
} from "./what-mattered";

export type NegativeLearningEvaluation =
  | "avoided"
  | "violated"
  | "not_applicable";

export type NegativeLearningRecord = {
  schema_version: "l2_negative";
  lesson_id: string;
  evaluation: NegativeLearningEvaluation;
  incorrect_ask_detected: boolean;
  preferred_fact_asked: boolean;
  situation_features_matched: string[];
  failure_type: string;
};

function lessonApplicable(
  lesson: NegativeLesson,
  features: string[],
  decisionTarget: string,
): boolean {
  if (lesson.id !== TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id) return false;
  const pathwayAsk =
    decisionTarget === "identify_available_pathways" ||
    decisionTarget === "identify_possible_pathways";
  if (!pathwayAsk) return false;
  return (
    features.includes("balance_due") ||
    features.includes("collection_notice") ||
    features.includes("asks_for_options") ||
    pathwayAsk
  );
}

function evaluateOne(opts: {
  lesson: NegativeLesson;
  features: string[];
  contract: QuestionContract;
  askNow: NeedToKnowItem[];
}): NegativeLearningRecord {
  const matched = opts.lesson.situation_features.filter((feature) =>
    opts.features.includes(feature),
  );
  if (
    !lessonApplicable(
      opts.lesson,
      opts.features,
      opts.contract.decision_target,
    )
  ) {
    return {
      schema_version: "l2_negative",
      lesson_id: opts.lesson.id,
      evaluation: "not_applicable",
      incorrect_ask_detected: false,
      preferred_fact_asked: false,
      situation_features_matched: matched,
      failure_type: opts.lesson.failure_type,
    };
  }

  const incorrect_ask_detected = opts.askNow.some(
    (item) =>
      isPrematureFinancialSchemaAsk(item.question) ||
      clarificationFactKey(item.question) === opts.lesson.incorrect_question,
  );
  const preferred_fact_asked = opts.askNow.some(
    (item) =>
      clarificationFactKey(item.question) === opts.lesson.preferred_fact,
  );

  return {
    schema_version: "l2_negative",
    lesson_id: opts.lesson.id,
    evaluation: incorrect_ask_detected ? "violated" : "avoided",
    incorrect_ask_detected,
    preferred_fact_asked,
    situation_features_matched: matched,
    failure_type: opts.lesson.failure_type,
  };
}

export function buildNegativeLearningRecords(opts: {
  message: string;
  contract: QuestionContract;
  askNow: NeedToKnowItem[];
  lessons?: NegativeLesson[];
}): NegativeLearningRecord[] {
  const features = extractSituationFeatures(opts.message);
  return (opts.lessons ?? SEEDED_NEGATIVE_LESSONS).map((lesson) =>
    evaluateOne({ ...opts, lesson, features }),
  );
}

export function hasNegativeLearningViolation(
  records: NegativeLearningRecord[],
): boolean {
  return records.some((record) => record.evaluation === "violated");
}

export function avoidedNegativeLessonIds(
  records: NegativeLearningRecord[],
): string[] {
  return records
    .filter((record) => record.evaluation === "avoided")
    .map((record) => record.lesson_id);
}
