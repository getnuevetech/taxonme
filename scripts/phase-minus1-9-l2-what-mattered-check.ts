import assert from "node:assert/strict";
import { askableNow, runConversationIntelligence } from "../src/lib/conversation";
import {
  EXPERIENCE_CANONICAL_NARRATIVE,
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON,
  buildNegativeLearningRecords,
  extractSituationFeatures,
  hasNegativeLearningViolation,
  type ExperienceRecordV0,
} from "../src/lib/experience";

const features = extractSituationFeatures(EXPERIENCE_CANONICAL_NARRATIVE);
assert.ok(features.includes("balance_due"));
assert.ok(features.includes("collection_notice"));
assert.ok(features.includes("uncertain_ability_to_pay"));
assert.ok(features.includes("multiple_tax_years"));

const intel = runConversationIntelligence({
  message: EXPERIENCE_CANONICAL_NARRATIVE,
});
const record = intel.experience_record as ExperienceRecordV0;
assert.ok(record.decision_changing_facts.includes("ability_to_pay"));
assert.ok(record.facts_discarded?.includes("full_form_433_package"));
assert.ok(
  record.facts_discarded?.includes("complete_financial_statement"),
);
assert.ok(
  !record.decision_changing_facts.includes("full_form_433_package"),
);
const lesson = record.negative_learning_records?.find(
  (item) => item.lesson_id === TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id,
);
assert.equal(lesson?.evaluation, "avoided");
assert.equal(lesson?.preferred_fact_asked, true);
assert.equal(
  hasNegativeLearningViolation(record.negative_learning_records || []),
  false,
);

const violated = buildNegativeLearningRecords({
  message: EXPERIENCE_CANONICAL_NARRATIVE,
  contract: intel.question_contract,
  askNow: [
    {
      question:
        "Complete the full Form 433 package with all income, expenses, and assets.",
      tier: "critical_now",
      reason: "Schema completeness",
      changes_branch: true,
      branches_affected: [],
    },
  ],
});
assert.equal(violated[0].evaluation, "violated");
assert.equal(hasNegativeLearningViolation(violated), true);
assert.match(askableNow(intel.need_to_know)[0].question, /pay/i);

console.log("phase-minus1-9-l2-what-mattered-check: ok");
