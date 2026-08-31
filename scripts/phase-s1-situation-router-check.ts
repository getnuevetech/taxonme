/**
 * Wave 5 / Phase S1 — Situation router + intake branching (tax fixtures).
 * Run: npx tsx scripts/phase-s1-situation-router-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  askableNow,
  composeAssistantReply,
  detectGovernmentMatter,
  mayPromoteAssistantToCase,
  runConversationIntelligence,
} from "../src/lib/conversation";

const CANONICAL =
  "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";

{
  const intel = runConversationIntelligence({
    message: CANONICAL,
    goal: "What are my options?",
  });
  assert.equal(intel.route.workspace, "situation");
  assert.equal(intel.route.invokes_case_engine, false);
  assert.equal(intel.route.pipeline, "assistant");
  assert.ok(intel.strategy.branches.length >= 2);
  if (!intel.strategy.branch_before_clarify) {
    const ask = askableNow(intel.need_to_know)[0] || intel.strategy.ask_now[0];
    assert.ok(ask);
  }
  const reply = composeAssistantReply(intel, CANONICAL);
  assert.match(reply, /installment|Currently Not Collectible|Offer in Compromise|pathway/i);
  assert.doesNotMatch(reply, /Want me to start|open a case\?/i);
}

{
  const intel = runConversationIntelligence({
    message: "I received this CP503. What does it mean?",
    goal: "Explain the notice",
    documentCount: 1,
    documentHints: ["cp503.pdf"],
  });
  assert.equal(intel.route.invokes_case_engine, false);
}

{
  const intel = runConversationIntelligence({
    message:
      "Review my entire pending CP2000 for tax year 2023 notice number 12345 and tell me what I should do next.",
    goal: "Full strategy",
  });
  assert.equal(intel.route.existing_government_case, true);
  assert.equal(intel.route.invokes_case_engine, true);
  assert.equal(intel.route.response_mode, "case_review");
}

{
  const intel = runConversationIntelligence({
    message: "Review my entire tax situation and tell me what I should file.",
    goal: "Full review",
  });
  assert.equal(intel.route.existing_government_case, false);
  assert.equal(intel.route.invokes_case_engine, false);
  assert.equal(intel.route.workspace, "situation");
}

{
  assert.equal(detectGovernmentMatter("yet to file any IRS forms").existing_government_case, false);
  assert.equal(
    detectGovernmentMatter("My CP2000 notice number 12345 is pending").existing_government_case,
    true,
  );
  const promo = mayPromoteAssistantToCase({
    contract: runConversationIntelligence({ message: CANONICAL }).question_contract,
    userExplicitlyRequestsCase: true,
    existingGovernmentCase: false,
  });
  assert.equal(promo.allowed, false);
}

{
  const intake = readFileSync(join(process.cwd(), "src/components/intake-wizard.tsx"), "utf8");
  assert.ok(!intake.includes('name="forceCase"'), "customer intake must not expose forceCase");
  const actions = readFileSync(join(process.cwd(), "src/actions/case.ts"), "utf8");
  assert.ok(actions.includes("invokes_case_engine"));
  assert.ok(actions.includes("createSituationFromIntelligence"));
  assert.ok(actions.includes("forceCase: false"));
  assert.ok(actions.includes("governmentSystem"));
}

{
  const spec = readFileSync(join(process.cwd(), "docs/v5.1/WAVE-5-SITUATION-PREP-PLAN.md"), "utf8");
  assert.ok(/Option B|Situation → Prep Plan/i.test(spec));
  assert.ok(/response_mode|Case engine/i.test(spec));
}

console.log("phase-s1-situation-router-check: ok");
