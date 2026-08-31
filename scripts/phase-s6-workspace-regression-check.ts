/**
 * Wave 5 / Phase S6 — consolidated workspace regression gate.
 * Run: npx tsx scripts/phase-s6-workspace-regression-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { composeAssistantReply, runConversationIntelligence } from "../src/lib/conversation";
import { buildPrepPlanContent } from "../src/lib/prep-plan";
import { decideLegacyCaseDisposition } from "../src/lib/situation-reclassify";

const CANONICAL =
  "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";

{
  const intel = runConversationIntelligence({ message: CANONICAL, goal: "What are my options?" });
  assert.equal(intel.route.workspace, "situation");
  assert.equal(intel.route.invokes_case_engine, false);
  const reply = composeAssistantReply(intel, CANONICAL);
  assert.match(reply, /installment|Currently Not Collectible|Offer in Compromise|pathway/i);
  assert.doesNotMatch(reply, /Want me to start|open a case\?/i);

  const plan = buildPrepPlanContent({
    pathways: intel.strategy.branches.map((b) => ({
      id: b.id,
      condition: b.condition,
      explanation: b.explanation,
    })),
    narrative: CANONICAL,
  });
  assert.ok(plan.filings.length >= 1);
  assert.equal(plan.preparationStatus, "draft");

  const disp = decideLegacyCaseDisposition({
    id: "legacy",
    number: 7,
    title: "options",
    situation: CANONICAL,
    goal: "options",
  });
  // CP503 is a government-matter signal → keep as Case if reclassifying that narrative alone.
  // For pure options without notice code:
  const optsOnly = decideLegacyCaseDisposition({
    id: "legacy2",
    number: 8,
    title: "options",
    situation: "I cannot pay my tax balance. What are my options before filing anything?",
    goal: "options",
  });
  assert.equal(optsOnly.action, "reclassify_to_situation");
  void disp;
}

{
  const intel = runConversationIntelligence({
    message: "I have pending CP2000 notice number 12345. What does this notice mean?",
    documentCount: 1,
    documentHints: ["cp2000.pdf"],
  });
  assert.equal(intel.route.customer_state, "existing_case");
  assert.equal(intel.route.invokes_case_engine, false);
}

{
  const intel = runConversationIntelligence({
    message:
      "Review my entire pending CP2000 for tax year 2023 notice number 12345, identify any risks, and tell me what I should do next.",
  });
  assert.equal(intel.route.invokes_case_engine, true);
  assert.equal(intel.route.response_mode, "case_review");
}

{
  const root = process.cwd();
  const sit = readFileSync(join(root, "src/components/situation-workspace-view.tsx"), "utf8");
  assert.ok(sit.includes("Your Tax Situation"));
  assert.ok(sit.includes("Build my Prep Plan"));

  const plan = readFileSync(join(root, "src/components/prep-plan-workspace-view.tsx"), "utf8");
  assert.ok(plan.includes("Prep Plan"));
  assert.ok(/not a Case/i.test(plan));

  const intake = readFileSync(join(root, "src/components/intake-wizard.tsx"), "utf8");
  assert.ok(!intake.includes('name="forceCase"'));

  const guide = readFileSync(join(root, "src/lib/guide.ts"), "utf8");
  assert.doesNotMatch(guide, /Want me to start/i);

  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes("model Situation"));
  assert.ok(schema.includes("model PrepPlan"));
  assert.ok(schema.includes("legacyCaseId"));

  const layout = readFileSync(join(root, "src/app/app/layout.tsx"), "utf8");
  assert.ok(layout.includes("/app/situations"));
}

console.log("phase-s6-workspace-regression-check: ok");
