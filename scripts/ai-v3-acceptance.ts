import assert from "node:assert/strict";
import { mergeStructured } from "../src/lib/ai/consensus";
import { validateAiJson } from "../src/lib/ai/validation";
import { STAGE_KEYS, STEP_ROLES } from "../src/lib/constants";
import { V3_PIPELINE_BLUEPRINT, V3_PROMPT_RECORDS } from "../src/lib/ai/v3-prompts";

const requiredRoles = [
  STEP_ROLES.FACT_EXTRACTOR,
  STEP_ROLES.GOAL_EXTRACTOR,
  STEP_ROLES.GOAL_INTERPRETER,
  STEP_ROLES.FEASIBILITY_ANALYST,
  STEP_ROLES.RECONCILER,
  STEP_ROLES.NOTICE_CLASSIFIER,
  STEP_ROLES.SOURCE_VERIFIER,
  STEP_ROLES.CASE_ASSISTANT,
  STEP_ROLES.MATCH_ANALYST,
  STEP_ROLES.MATCH_REVIEWER,
  STEP_ROLES.RECOMMENDATION_DRAFTER,
  STEP_ROLES.LETTER_DRAFTER,
  STEP_ROLES.FINAL_EDITOR,
  STEP_ROLES.CLOSURE_SUMMARIZER,
  STEP_ROLES.CLOSURE_REVIEWER,
];

for (const role of requiredRoles) {
  assert.ok(Object.values(STEP_ROLES).includes(role), `missing role ${role}`);
}

const promptIds = new Set(V3_PROMPT_RECORDS.map((p) => p.promptId));
for (const stage of V3_PIPELINE_BLUEPRINT) {
  for (const step of stage.steps) {
    assert.ok(promptIds.has(step.promptId), `${stage.key}/${step.role} references missing prompt ${step.promptId}`);
  }
}

const situation = V3_PIPELINE_BLUEPRINT.find((p) => p.key === STAGE_KEYS.SITUATION);
assert.ok(situation?.sourceRequired, "tax situation analysis must require authoritative source context");
assert.ok(situation?.reviewerRequired, "tax situation analysis must require a reviewer gate");
assert.ok(situation?.steps.some((s) => s.role === STEP_ROLES.SOURCE_VERIFIER), "tax situation must include source verifier");
assert.ok(situation?.steps.some((s) => s.role === STEP_ROLES.REVIEWER), "tax situation must include reviewer");

const guide = V3_PIPELINE_BLUEPRINT.find((p) => p.key === STAGE_KEYS.GUIDE);
assert.ok(guide?.steps.some((s) => s.role === STEP_ROLES.CASE_ASSISTANT && s.mode === "failover"), "guide must use case-assistant failover");

const matching = V3_PIPELINE_BLUEPRINT.find((p) => p.key === STAGE_KEYS.MATCH);
assert.deepEqual(
  matching?.steps.map((s) => s.role),
  [STEP_ROLES.MATCH_ANALYST, STEP_ROLES.MATCH_REVIEWER],
  "consultant matching AI must stay inside the deterministic eligible pool",
);

const disagreement = mergeStructured([
  { source: "extractor_a", data: { amount_due: 2620.07 } },
  { source: "extractor_b", data: { amount_due: 262.07 } },
]);
assert.equal(disagreement.conflicts.length, 1, "A/B amount disagreement must be flagged");
assert.equal((disagreement.merged.amount_due as Record<string, unknown>).__conflict, true, "disputed amount must not be silently merged");

assert.equal(validateAiJson(STAGE_KEYS.PRESENTER, { finding_card: { headline: "No invented deadline" } }).ok, true);
assert.equal(validateAiJson(STAGE_KEYS.PRESENTER, { answer: "not a presenter object" }).ok, false);
assert.equal(validateAiJson(STAGE_KEYS.GUIDE, { answer: "Please upload the notice.", requires_reanalysis: true }).ok, true);

console.log("AI v3 acceptance checks passed.");
