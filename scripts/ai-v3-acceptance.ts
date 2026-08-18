import assert from "node:assert/strict";
import { validateAiJson } from "../src/lib/ai/validation";
import { redactSensitiveText, sourceSnapshotId } from "../src/lib/ai/privacy";
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
assert.ok(V3_PROMPT_RECORDS.every((p) => /-v3(1)?$/.test(p.promptId) || p.promptId === "GLOBAL-RULES-v3"), "all production prompts must be versioned v3/v31 IDs");
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
assert.equal(matching?.reviewerRequired, true, "consultant matching must require review");

const letter = V3_PIPELINE_BLUEPRINT.find((p) => p.key === STAGE_KEYS.LETTER);
assert.ok(letter?.steps.some((s) => s.role === STEP_ROLES.LETTER_DRAFTER), "letter flow must include drafter");
assert.ok(letter?.steps.some((s) => s.role === STEP_ROLES.REVIEWER), "letter flow must include reviewer");
assert.ok(letter?.steps.some((s) => s.role === STEP_ROLES.FINAL_EDITOR), "letter flow must include final editor");

const closing = V3_PIPELINE_BLUEPRINT.find((p) => p.key === STAGE_KEYS.CLOSING);
assert.deepEqual(
  closing?.steps.map((s) => s.role),
  [STEP_ROLES.CLOSURE_SUMMARIZER, STEP_ROLES.CLOSURE_REVIEWER, STEP_ROLES.PRESENTER],
  "closure flow must summarize, review, then present",
);

const documentStage = V3_PIPELINE_BLUEPRINT.find((p) => p.key === STAGE_KEYS.DOCUMENT);
assert.ok(documentStage?.steps.some((s) => s.role === STEP_ROLES.EXTRACTOR_A && s.mode === "parallel"), "document extractor A must run as an independent pass");
assert.ok(documentStage?.steps.some((s) => s.role === STEP_ROLES.EXTRACTOR_B && s.mode === "parallel"), "document extractor B must run as an independent pass");
assert.ok(documentStage?.steps.some((s) => s.role === STEP_ROLES.RECONCILER), "document stage must include reconciliation");
assert.ok(documentStage?.steps.some((s) => s.role === STEP_ROLES.REVIEWER && s.isConditional), "document reviewer must be conditional for critical disputes");
assert.equal(validateAiJson(STAGE_KEYS.PRESENTER, { finding_card: { headline: "No invented deadline" } }).ok, true);
assert.equal(validateAiJson(STAGE_KEYS.PRESENTER, { answer: "not a presenter object" }).ok, false);
assert.equal(validateAiJson(STAGE_KEYS.GUIDE, { answer: "Please upload the notice.", requires_reanalysis: true }).ok, true);
assert.equal(redactSensitiveText("SSN 123-45-6789 and account 123456789012"), "SSN [REDACTED_TIN] and account [REDACTED_ACCOUNT_ID]");
assert.match(sourceSnapshotId("[Pub 594] IRS collection process"), /^[a-f0-9]{24}$/);

console.log("AI v3 acceptance checks passed.");
