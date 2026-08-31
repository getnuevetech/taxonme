import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runConversationIntelligence } from "../src/lib/conversation";
import {
  EXPERIENCE_CANONICAL_NARRATIVE,
  PROMOTION_LABELS,
  PROMOTION_LEVELS,
  canPromoteToProduction,
  deidentifyExperienceRecord,
  parsePromotionLevel,
  type ExperienceRecordV0,
} from "../src/lib/experience";

assert.deepEqual(PROMOTION_LEVELS, [0, 1, 2, 3, 4]);
assert.equal(PROMOTION_LABELS[4], "Production");
assert.equal(parsePromotionLevel("3"), 3);
assert.throws(() => parsePromotionLevel(5));

const record = runConversationIntelligence({
  message: EXPERIENCE_CANONICAL_NARRATIVE,
}).experience_record as ExperienceRecordV0;
const anon = deidentifyExperienceRecord(record, {
  sourceId: "tax_registry",
});
assert.equal(canPromoteToProduction(anon).ok, true);
assert.equal(
  canPromoteToProduction({
    ...anon,
    decision_target: "",
    decision_changing_facts: [],
    negative_lesson_ids: [],
  }).ok,
  false,
);
assert.match(
  readFileSync("src/app/admin/experience/page.tsx", "utf8"),
  /Pattern Registry/,
);
assert.match(
  readFileSync("src/app/admin/layout.tsx", "utf8"),
  /\/admin\/experience/,
);
assert.match(
  readFileSync("src/lib/constants.ts", "utf8"),
  /admin\.experience/,
);

console.log("phase-minus1-9-l5-pattern-registry-check: ok");
