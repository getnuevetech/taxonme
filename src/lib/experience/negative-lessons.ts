/**
 * Seeded institutional failure patterns. These contain no customer identities.
 */
export type NegativeLesson = {
  id: string;
  failure_type: string;
  situation_features: string[];
  user_question_pattern: string;
  incorrect_question: string;
  reason: string;
  preferred_fact: string;
  correct_behavior: string[];
  lesson: string;
  promotion_level: 0 | 1 | 2 | 3 | 4;
  seeded: true;
};

export const TAX_RELIEF_SCHEMA_NEGATIVE_LESSON: NegativeLesson = {
  id: "NEG-TAX-RELIEF-SCHEMA-001",
  failure_type: "premature_clarification",
  situation_features: [
    "balance_due",
    "collection_notice",
    "uncertain_ability_to_pay",
  ],
  user_question_pattern: "identify_available_pathways",
  incorrect_question: "full_form_433_package",
  reason: "did_not_change_initial_pathway",
  preferred_fact: "ability_to_pay",
  correct_behavior: [
    "explain_primary_relief_pathways_first",
    "identify_ability_to_pay_as_controlling",
    "ask_one_targeted_payment_capacity_question",
    "defer_complete_financial_statement",
    "do_not_run_full_v51",
  ],
  lesson: "schema completeness must not outrank pathway relevance",
  promotion_level: 3,
  seeded: true,
};

/** Descriptive compatibility alias for schema-dump suppression. */
export const SCHEMA_DUMP_NEGATIVE_LESSON = TAX_RELIEF_SCHEMA_NEGATIVE_LESSON;

export const SEEDED_NEGATIVE_LESSONS: NegativeLesson[] = [
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON,
];

export function findNegativeLessonsForDecisionTarget(
  decisionTarget: string,
): NegativeLesson[] {
  return decisionTarget === "identify_available_pathways" ||
    decisionTarget === "identify_possible_pathways"
    ? [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON]
    : [];
}

export function isPrematureFinancialSchemaAsk(question: string): boolean {
  return /(?:full|complete|every|all).{0,30}(?:form\s*433|financial (?:statement|package)|income.{0,20}expenses.{0,20}assets)|form\s*433[-a-z]*.{0,20}(?:complete|all fields|package)/i.test(
    question,
  );
}
