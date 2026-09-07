/**
 * Package H — Pipeline A / Prep Plan pathway honesty.
 * Run: npx tsx scripts/phase-package-h-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const THIN =
  "I owe IRS some money but I am not sure how much and what I need to do.";

async function main() {
  const { analyzeBranches } = await import("../src/lib/conversation/branch-analysis");
  const { canSurfaceResolutionPathways } = await import(
    "../src/lib/conversation/pathway-eligibility"
  );
  const { buildPrepPlanContent, inferPathwayFromNarrative } = await import("../src/lib/prep-plan");
  const { runConversationIntelligence } = await import("../src/lib/conversation");
  const { composeAssistantView } = await import("../src/lib/conversation/assistant-composer");

  assert.equal(canSurfaceResolutionPathways(THIN), false);
  assert.equal(
    canSurfaceResolutionPathways(
      "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?",
    ),
    true,
  );

  const thinBranches = analyzeBranches({
    contract: {
      explicit_question: THIN,
      interpreted_question: THIN,
      decision_target: "identify_available_pathways",
      entities: [],
      constraints: [],
      success_criteria: [],
      ambiguity_flags: [],
    } as never,
    message: THIN,
  });
  const thinBlob = JSON.stringify(thinBranches);
  assert.equal(thinBranches.branches.some((b) => b.id === "establish_account_position"), true);
  assert.equal(thinBranches.branches.some((b) => b.id === "installment_agreement"), false);
  assert.doesNotMatch(thinBlob, /9465|\$50,?000|offer in compromise|currently not collectible/i);

  const rich =
    "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";
  const richBranches = analyzeBranches({
    contract: {
      explicit_question: rich,
      interpreted_question: rich,
      decision_target: "identify_available_pathways",
      entities: [],
      constraints: [],
      success_criteria: [],
      ambiguity_flags: [],
    } as never,
    message: rich,
  });
  assert.ok(richBranches.branches.some((b) => b.id === "installment_agreement"));
  assert.doesNotMatch(JSON.stringify(richBranches), /\$50,?000|streamlined options often apply/i);

  assert.equal(inferPathwayFromNarrative(THIN), "establish_account_position");
  assert.equal(inferPathwayFromNarrative("I want a payment plan / Form 9465"), "installment_agreement");

  const thinPlan = buildPrepPlanContent({ narrative: THIN });
  assert.equal(thinPlan.selectedPathway, "establish_account_position");
  assert.equal(thinPlan.filings.some((f) => f.form === "9465"), false);
  assert.match(thinPlan.pathwayLabel, /Establish what the IRS shows/i);

  const ia = buildPrepPlanContent({ selectedPathway: "installment_agreement" });
  assert.ok(ia.filings.some((f) => f.form === "9465"));

  const intel = runConversationIntelligence({ message: THIN, goal: "what should I do?" });
  const view = composeAssistantView(intel, THIN);
  const viewText = JSON.stringify(view);
  assert.doesNotMatch(viewText, /Form 9465|\$50,?000|Offer in Compromise/i);

  const s3 = runConversationIntelligence({
    message: rich,
    goal: "What are my options?",
  });
  const s3Plan = buildPrepPlanContent({
    pathways: s3.strategy.branches.map((b) => ({
      id: b.id,
      condition: b.condition,
      explanation: b.explanation,
    })),
    narrative: rich,
  });
  assert.ok(s3Plan.selectedPathway);
  assert.ok(s3Plan.filings.length >= 1);

  const root = process.cwd();
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-H-PIPELINE-A-PATHWAY-HONESTY.md"), "utf8"),
    /Package H/i,
  );
  assert.match(
    readFileSync(join(root, "src/lib/conversation/branch-analysis.ts"), "utf8"),
    /canSurfaceResolutionPathways/,
  );

  console.log("phase-package-h-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
