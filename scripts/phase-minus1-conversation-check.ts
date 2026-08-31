/**
 * Wave 4 / Phase −1 Conversation Intelligence — tax acceptance tests.
 * Run: npm run test:phase-minus1
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  askableNow,
  composeAssistantReply,
  caseMustAnswerBeforeClarify,
  mayPromoteAssistantToCase,
  runConversationIntelligence,
} from "../src/lib/conversation";

function assertAssistant(message: string, goal = "Understand my options", docs = 0) {
  const intel = runConversationIntelligence({ message, goal, documentCount: docs });
  assert.equal(intel.route.pipeline, "assistant", `expected assistant for: ${message.slice(0, 60)}`);
  return intel;
}

// 1) Can't pay — pathways + ≤1 ask; no Case engine
{
  const msg = "I got an IRS letter and can't pay. What can I do?";
  const intel = assertAssistant(msg);
  const reply = composeAssistantReply(intel, msg);
  assert.match(reply, /installment|pathways|Currently Not Collectible|Offer in Compromise/i);
  assert.ok(askableNow(intel.need_to_know).length <= 1);
  assert.equal(intel.question_contract.requires_case_development, false);
  assert.equal(intel.route.invokes_case_engine, false);
}

// 2) Balance options — branches before clarify
{
  const msg =
    "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";
  const intel = assertAssistant(msg);
  assert.equal(intel.question_contract.decision_target, "identify_available_pathways");
  assert.equal(intel.strategy.branch_before_clarify, true);
  assert.ok(intel.strategy.branches.length >= 2);
  const reply = composeAssistantReply(intel, msg);
  assert.match(reply, /installment|Currently Not Collectible|Offer in Compromise|penalty/i);
  assert.ok(intel.strategy.ask_now.every((q) => q.changes_branch && q.tier === "critical_now"));
}

// 3) What is CP2000 — explain; no intake
{
  const intel = assertAssistant("What is a CP2000?");
  const reply = composeAssistantReply(intel, "What is a CP2000?");
  assert.match(reply, /CP2000|underreporter/i);
  assert.equal(intel.route.pipeline, "assistant");
}

// 4) Upload CP503 + what does this mean — still Assistant
{
  const intel = assertAssistant("I received this CP503. What does it mean?", "Explain the notice", 1);
  assert.equal(intel.route.pipeline, "assistant");
  const promo = mayPromoteAssistantToCase({
    contract: intel.question_contract,
    userExplicitlyRequestsCase: false,
    documentCount: 1,
  });
  assert.equal(promo.allowed, false);
  assert.match(promo.reason, /upload alone/i);
}

// 5) Comprehensive unfiled review → Situation (not Case engine)
{
  const intel = runConversationIntelligence({
    message: "Review my entire tax situation and tell me what I should file.",
  });
  assert.equal(intel.route.invokes_case_engine, false);
  assert.equal(intel.route.workspace, "situation");
}

// 5b) Comprehensive pending notice review → Case engine
{
  const intel = runConversationIntelligence({
    message:
      "Review my entire pending CP2000 for tax year 2023 notice number 12345 and tell me what I should do next.",
  });
  assert.equal(intel.route.invokes_case_engine, true);
  assert.equal(intel.route.pipeline, "case");
}

// 6) Facts, no question — no case engine
{
  const intel = assertAssistant(
    "I owe about five thousand for 2022, got a balance due letter, work W-2 only, no payment plan yet.",
    "Help",
  );
  assert.equal(intel.question_contract.requires_case_development, false);
  assert.equal(intel.route.pipeline, "assistant");
}

// 7) Documents needed — answer list; don't demand uploads
{
  const intel = assertAssistant("What documents do I need to respond to an IRS balance due notice?");
  const reply = composeAssistantReply(intel, "What documents do I need to respond to an IRS balance due notice?");
  assert.match(reply, /transcript|W-2|notice|documents/i);
  assert.doesNotMatch(reply, /please upload/i);
  assert.equal(intel.answerability.requires_document, false);
}

// 8) CP503 upload explain
{
  const intel = assertAssistant("What is this CP503?", "Explain", 1);
  const reply = composeAssistantReply(intel, "What is this CP503?");
  assert.match(reply, /CP503|collection/i);
  assert.equal(intel.route.pipeline, "assistant");
}

// 9) Build IRS strategy with no filed matter → Situation
{
  const intel = runConversationIntelligence({
    message: "Build a strategy to resolve all my IRS balances for 2022–2025.",
    goal: "Resolve all balances",
  });
  assert.equal(intel.route.invokes_case_engine, false);
  assert.ok(intel.route.workspace === "situation" || intel.route.pipeline === "assistant");
}

// Router ≠ interpreter decree
{
  const intel = runConversationIntelligence({
    message: "I got an IRS letter and can't pay. What can I do?",
    goal: "Options",
    documentCount: 2,
  });
  assert.equal(intel.intent.recommended_pipeline, "assistant");
  assert.equal(intel.route.pipeline, "assistant");
  assert.ok(intel.route.reason.length > 10);
}

// clarify_first rare
{
  const intel = runConversationIntelligence({ message: "Can I file form X?", goal: "File" });
  assert.equal(intel.answerability.clarify_first_required, true);
  assert.ok(intel.answerability.clarify_first_reason.length > 10);
}

// Case answer-before-clarify helpers
{
  assert.equal(
    caseMustAnswerBeforeClarify(
      "I owe the IRS and got a CP503 — what are my options?",
      "Find a path",
    ),
    true,
  );
  const comprehensive = runConversationIntelligence({
    message: "Review my entire tax situation and tell me what I should file.",
  });
  assert.equal(comprehensive.answerability.clarify_first_required, false);
}

// Wiring evidence
{
  const intake = readFileSync(join(process.cwd(), "src/actions/case.ts"), "utf8");
  assert.ok(intake.includes("runConversationIntelligence"), "intake must run Phase −1 intelligence");
  assert.ok(intake.includes("invokes_case_engine"), "intake must branch on response_mode / case engine");
  assert.ok(intake.includes("mayPromoteAssistantToCase"), "promotion gate must exist");

  const userAsk = readFileSync(join(process.cwd(), "src/actions/user.ts"), "utf8");
  assert.ok(userAsk.includes("runConversationIntelligence"), "Q&A must run Phase −1 intelligence");

  const guide = readFileSync(join(process.cwd(), "src/lib/guide.ts"), "utf8");
  assert.ok(!/Want me to start it as a new case/i.test(guide), "guide must not force-open a case");

  const spec = readFileSync(join(process.cwd(), "docs/v5.1/WAVE-4-CONVERSATION-INTELLIGENCE.md"), "utf8");
  assert.ok(spec.includes("Question Contract"));
  assert.ok(spec.includes("Conversation Router"));
  assert.ok(/upload alone/i.test(spec), "spec must forbid upload-alone promotion");
}

console.log("phase-minus1-conversation-check: ok");
