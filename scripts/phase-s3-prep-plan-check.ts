/**
 * Wave 5 / Phase S3 — Prep Plan workspace checks.
 * Run: npx tsx scripts/phase-s3-prep-plan-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPrepPlanContent } from "../src/lib/prep-plan";
import { runConversationIntelligence } from "../src/lib/conversation";

const CANONICAL =
  "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";

{
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "What are my options?" });
  assert.equal(intel.route.workspace, "situation");
  assert.equal(intel.route.invokes_case_engine, false);

  const plan = buildPrepPlanContent({
    pathways: intel.strategy.branches.map((b) => ({
      id: b.id,
      condition: b.condition,
      explanation: b.explanation,
    })),
    narrative: CANONICAL,
  });
  assert.ok(plan.selectedPathway);
  assert.ok(plan.filings.length >= 1);
  assert.ok(plan.sequence.some((s) => /case/i.test(s)), "sequence should mention Case only after filing");
  assert.equal(plan.preparationStatus, "draft");
  assert.doesNotMatch(plan.pathwayLabel, /YOUR TAX CASE/i);
}

{
  const ia = buildPrepPlanContent({ selectedPathway: "installment_agreement" });
  assert.ok(ia.filings.some((f) => f.form === "9465"));
  assert.ok(ia.evidenceNeeds.every((e) => !/open a case/i.test(e)));

  const oic = buildPrepPlanContent({ selectedPathway: "offer_in_compromise" });
  assert.ok(oic.filings.some((f) => f.form === "656"));
}

{
  const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes("model PrepPlan"));

  const action = readFileSync(join(process.cwd(), "src/actions/prep-plan.ts"), "utf8");
  assert.ok(action.includes("createPrepPlanAction"));
  assert.ok(action.includes("getPrepPlanQuota"));
  assert.ok(!action.includes("runCaseAnalysis"), "Prep Plan must not run Case analysis");

  const sitView = readFileSync(join(process.cwd(), "src/components/situation-workspace-view.tsx"), "utf8");
  assert.ok(sitView.includes("Build my Prep Plan") || sitView.includes("Upgrade to Plus to build a Prep Plan"));
  assert.ok(sitView.includes("createPrepPlanAction") || sitView.includes("billing?upgrade=prep_plan"));

  const planView = readFileSync(join(process.cwd(), "src/components/prep-plan-workspace-view.tsx"), "utf8");
  assert.ok(planView.includes("Prep Plan"));
  assert.ok(/not a Case/i.test(planView));

  const appPage = readFileSync(join(process.cwd(), "src/app/app/prep-plans/[id]/page.tsx"), "utf8");
  assert.ok(appPage.includes("PrepPlanWorkspaceView"));

  const quotas = readFileSync(join(process.cwd(), "src/lib/billing-quotas.ts"), "utf8");
  assert.ok(quotas.includes("db.prepPlan.count"));
}

console.log("phase-s3-prep-plan-check: ok");
