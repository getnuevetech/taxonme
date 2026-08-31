import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runConversationIntelligence } from "../src/lib/conversation";
import {
  ALLOWED_AUTHORITY_PUBLISHERS,
  EXPERIENCE_CANONICAL_NARRATIVE,
  GOVERNMENT_SYSTEMS,
  OUTCOME_KINDS,
  applyGovernmentOutcome,
  assertIsOutcomeCandidate,
  buildOutcomePatternCandidate,
  checkOutcomeAuthority,
  type ExperienceRecordV0,
} from "../src/lib/experience";

assert.deepEqual(GOVERNMENT_SYSTEMS, [
  "irs",
  "state_dor",
  "tax_court_collections",
]);
assert.deepEqual(ALLOWED_AUTHORITY_PUBLISHERS, [
  "IRS",
  "STATE_DOR",
  "TAX_COURT",
]);
for (const kind of [
  "installment_agreement_accepted",
  "currently_not_collectible",
  "offer_in_compromise_accepted",
  "penalty_abatement",
  "notice_resolved",
  "assessment_confirmed",
  "levy_released",
] as const) {
  assert.ok(OUTCOME_KINDS.includes(kind));
}

assert.equal(
  checkOutcomeAuthority({
    outcome_kind: "notice_resolved",
    government_system: "irs",
    form_or_notice_key: "cp503",
    authority_keys: [],
    authority_publisher: "IRS",
    note_key: "notice_resolved",
  }).ok,
  false,
);

const input = {
  outcome_kind: "installment_agreement_accepted",
  government_system: "irs",
  form_or_notice_key: "form_9465",
  decision_changing_facts: ["ability_to_pay"],
  authority_keys: ["irs_installment_agreement_guidance"],
  authority_publisher: "IRS",
  note_key: "monthly_plan_accepted",
} as const;
const gate = checkOutcomeAuthority(input);
assert.equal(gate.ok, true);
assert.equal(gate.signal_precedence, "historical_experience");
assert.equal(gate.outranked_by, "current_authority");

const record = runConversationIntelligence({
  message: EXPERIENCE_CANONICAL_NARRATIVE,
}).experience_record as ExperienceRecordV0;
const updated = applyGovernmentOutcome(record, input);
assert.equal(updated.outcome?.kind, "installment_agreement_accepted");
const candidate = buildOutcomePatternCandidate(updated, {
  sourceId: "tax_outcome",
});
assert.equal(candidate.promotion_level, 1);
assert.equal(candidate.outcome?.government_system, "irs");
assertIsOutcomeCandidate(candidate);
assert.match(
  readFileSync("src/actions/experience-outcome.ts", "utf8"),
  /historical experience/,
);

console.log("phase-minus1-9-l4-outcomes-check: ok");
