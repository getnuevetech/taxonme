import assert from "node:assert/strict";
import { askableNow, runConversationIntelligence } from "../src/lib/conversation";
import {
  EXPERIENCE_CANONICAL_NARRATIVE,
  SEEDED_NEGATIVE_LESSONS,
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON,
  isPrematureFinancialSchemaAsk,
  type ExperienceRecordV0,
} from "../src/lib/experience";

assert.equal(
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id,
  "NEG-TAX-RELIEF-SCHEMA-001",
);
assert.equal(
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.incorrect_question,
  "full_form_433_package",
);
assert.equal(
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.preferred_fact,
  "ability_to_pay",
);
assert.ok(
  SEEDED_NEGATIVE_LESSONS.includes(TAX_RELIEF_SCHEMA_NEGATIVE_LESSON),
);

const intel = runConversationIntelligence({
  message: EXPERIENCE_CANONICAL_NARRATIVE,
});
const record = intel.experience_record as ExperienceRecordV0;
assert.equal(record.schema_version, "l0");
assert.equal(record.capture_enrichment, "l2");
assert.equal(record.decision_target, "identify_available_pathways");
assert.ok(record.facts_discarded?.includes("full_form_433_package"));
assert.ok(
  record.negative_lesson_ids.includes("NEG-TAX-RELIEF-SCHEMA-001"),
);
assert.equal(record.invokes_case_engine, false);
assert.equal(record.outcome, null);
const ask = askableNow(intel.need_to_know)[0];
assert.ok(ask);
assert.equal(isPrematureFinancialSchemaAsk(ask.question), false);
assert.match(ask.question, /monthly payment|paying anything/i);

console.log("phase-minus1-9-experience-l0-check: ok");
