import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runConversationIntelligence } from "../src/lib/conversation";
import {
  EXPERIENCE_CANONICAL_NARRATIVE,
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  filterForCrossUserRead,
  scrubFreeText,
  textLooksLikePii,
  type ExperienceRecordV0,
} from "../src/lib/experience";

assert.equal(textLooksLikePii("jane@example.com"), true);
assert.equal(textLooksLikePii("123-45-6789"), true);
assert.equal(textLooksLikePii("12-3456789"), true);
assert.equal(textLooksLikePii("P12345678"), true);
assert.equal(textLooksLikePii("ability_to_pay"), false);
assert.match(scrubFreeText("Email jane@example.com"), /\[redacted\]/);

const record = runConversationIntelligence({
  message: EXPERIENCE_CANONICAL_NARRATIVE,
}).experience_record as ExperienceRecordV0;
const poisoned: ExperienceRecordV0 = {
  ...record,
  question_contract: {
    ...record.question_contract,
    explicit_question: "Help jane@example.com at 123 Main Street",
  },
  documents_used: ["Jane_CP503_123-45-6789.pdf"],
  clarification_selected: {
    key: "ability_to_pay",
    question: "Can you pay monthly? Call 555-123-4567",
    reason: "Changes relief pathway",
  },
};
const anon = deidentifyExperienceRecord(poisoned, {
  sourceId: "situation_test",
});
assert.equal(anon.schema_version, "l1_anon");
assert.equal(anon.promotion_level, 0);
assert.ok(!("question_contract" in anon));
assert.doesNotMatch(
  JSON.stringify(anon),
  /jane@|Main Street|555-123|123-45-6789/i,
);
assertSafeForSharedExperience(anon);
assert.equal(
  filterForCrossUserRead(
    [{ ownerUserId: "owner", raw: poisoned, anon }],
    "other",
  )[0].schema_version,
  "l1_anon",
);

const migration = readFileSync(
  "prisma/migrations/20260831190000_experience_observation/migration.sql",
  "utf8",
);
assert.match(migration, /ExperienceObservation/);
assert.match(readFileSync("src/lib/situation-create.ts", "utf8"), /publishAnonymizedObservation/);

console.log("phase-minus1-9-l1-deid-check: ok");
