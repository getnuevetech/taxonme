import assert from "node:assert/strict";
import { STAGE_KEYS, STEP_ROLES } from "../src/lib/constants";
import { validateAiJson } from "../src/lib/ai/validation";
import { redactSensitiveText } from "../src/lib/ai/privacy";
import { RESPONSIBILITY_PROMPTS, V3_PIPELINE_BLUEPRINT } from "../src/lib/ai/v3-prompts";

function promptBody(promptId: string): string {
  const prompt = RESPONSIBILITY_PROMPTS.find((p) => p.promptId === promptId);
  assert.ok(prompt, `missing prompt ${promptId}`);
  return prompt.body.toLowerCase();
}

function stageRoles(stageKey: string): string[] {
  const stage = V3_PIPELINE_BLUEPRINT.find((p) => p.key === stageKey);
  assert.ok(stage, `missing stage ${stageKey}`);
  return stage.steps.map((s) => s.role);
}

// Appendix C/H: user belief must not become confirmed IRS fact.
assert.match(promptBody("RESP-FACT-v3"), /belief/);
assert.match(promptBody("RESP-FACT-v3"), /user_reported/);
assert.match(promptBody("RESP-FACT-v3"), /do not solve/);

// Goal wording must not directly become one remedy.
assert.match(promptBody("RESP-GOAL-INT-v3"), /remove my debt/);
assert.match(promptBody("RESP-GOAL-INT-v3"), /not automatically/);

// Extractor A/B independent passes plus reconciler/reviewer.
const doc = V3_PIPELINE_BLUEPRINT.find((p) => p.key === STAGE_KEYS.DOCUMENT)!;
assert.equal(doc.steps.find((s) => s.role === STEP_ROLES.EXTRACTOR_A)?.mode, "parallel");
assert.equal(doc.steps.find((s) => s.role === STEP_ROLES.EXTRACTOR_B)?.mode, "parallel");
assert.ok(doc.steps.some((s) => s.role === STEP_ROLES.RECONCILER));
assert.ok(doc.steps.some((s) => s.role === STEP_ROLES.REVIEWER && s.isConditional));
assert.match(promptBody("RESP-REC-v3"), /never average/);

// Missing source must block material tax conclusions.
assert.match(promptBody("RESP-ANL-v3"), /do not manufacture/);
assert.match(promptBody("RESP-SRC-v3"), /source_missing/);
assert.match(promptBody("RESP-REV-v3"), /downgrade/);

// Reviewer controls presentation.
assert.deepEqual(stageRoles(STAGE_KEYS.SITUATION).slice(-3), [
  STEP_ROLES.SOURCE_VERIFIER,
  STEP_ROLES.SKEPTIC,
  STEP_ROLES.REVIEWER,
]);
assert.deepEqual(stageRoles(STAGE_KEYS.PRESENTER), [STEP_ROLES.PRESENTER]);
assert.equal(validateAiJson(STAGE_KEYS.PRESENTER, { finding_card: { headline: "2024 refund difference identified" }, what_we_found: [] }).ok, true);
assert.equal(validateAiJson(STAGE_KEYS.PRESENTER, { invented_deadline: "tomorrow" }).ok, false);

// Case Guide must capture new facts and request re-analysis.
assert.match(promptBody("RESP-CASE-v3"), /requires_reanalysis=true/);
assert.equal(validateAiJson(STAGE_KEYS.GUIDE, { answer: "I captured that.", new_material_fact_detected: true, captured_fact: "New CP2000 notice", requires_reanalysis: true }).ok, true);

// Consultant AI cannot restore ineligible candidates.
assert.deepEqual(stageRoles(STAGE_KEYS.MATCH), [STEP_ROLES.MATCH_ANALYST, STEP_ROLES.MATCH_REVIEWER]);
assert.match(promptBody("RESP-MATCH-ANL-v3"), /rank only candidates who already passed deterministic eligibility/);
assert.match(promptBody("RESP-MATCH-REV-v3"), /deterministically eligible/);

// Letter and closure safety.
assert.match(promptBody("RESP-LTR-DRAFT-v3"), /do not fabricate/);
assert.match(promptBody("RESP-CLOSE-SUM-v3"), /do not call an issue resolved/);
assert.deepEqual(stageRoles(STAGE_KEYS.CLOSING), [
  STEP_ROLES.CLOSURE_SUMMARIZER,
  STEP_ROLES.CLOSURE_REVIEWER,
  STEP_ROLES.PRESENTER,
]);

// Privacy redaction fixture.
assert.equal(
  redactSensitiveText("Taxpayer SSN 123-45-6789, EIN 12-3456789, account 123456789012."),
  "Taxpayer SSN [REDACTED_TIN], EIN [REDACTED_EIN], account [REDACTED_ACCOUNT_ID].",
);

console.log("AI v3 fixture acceptance checks passed.");
