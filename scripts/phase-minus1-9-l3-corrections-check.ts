import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runConversationIntelligence } from "../src/lib/conversation";
import {
  EXPERIENCE_CANONICAL_NARRATIVE,
  PATTERN_CANDIDATE_LEVEL,
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON,
  applyConsultantCorrection,
  assertIsPatternCandidate,
  buildPatternCandidate,
  inferLessonId,
  normalizeCorrectionInput,
  type ExperienceRecordV0,
} from "../src/lib/experience";

const correction = normalizeCorrectionInput({
  failure_type: "premature_clarification",
  incorrect_key: "full_form_433_package",
  preferred_key: "ability_to_pay",
  note_key: "ask_payment_capacity_first",
});
assert.equal(
  inferLessonId(correction),
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id,
);
assert.throws(() =>
  normalizeCorrectionInput({
    failure_type: "premature_clarification",
    incorrect_key: "Jane's financial package",
    preferred_key: "ability_to_pay",
    note_key: "ask_payment_capacity_first",
  }),
);

const record = runConversationIntelligence({
  message: EXPERIENCE_CANONICAL_NARRATIVE,
}).experience_record as ExperienceRecordV0;
const corrected = applyConsultantCorrection(
  {
    ...record,
    decision_changing_facts: ["full_form_433_package"],
    reviewer_correction: null,
  },
  correction,
);
assert.ok(corrected.decision_changing_facts.includes("ability_to_pay"));
assert.ok(
  !corrected.decision_changing_facts.includes("full_form_433_package"),
);
assert.ok(corrected.facts_discarded?.includes("full_form_433_package"));
const candidate = buildPatternCandidate(corrected, {
  sourceId: "tax_correction",
});
assert.equal(candidate.promotion_level, PATTERN_CANDIDATE_LEVEL);
assert.equal(candidate.correction?.preferred_key, "ability_to_pay");
assertIsPatternCandidate(candidate);
assert.match(
  readFileSync("src/actions/experience-correction.ts", "utf8"),
  /ROLES\.CONSULTANT/,
);

console.log("phase-minus1-9-l3-corrections-check: ok");
