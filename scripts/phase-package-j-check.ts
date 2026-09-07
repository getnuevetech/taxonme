/**
 * Package J — Pipeline A UX (−1.8 + minimal −1.7 continuity).
 * Run: npx tsx scripts/phase-package-j-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const root = process.cwd();
  const {
    composeAssistantView,
    composeAssistantReply,
    decisionFocusLabel,
    runConversationIntelligence,
    STARTER_PROMPTS,
  } = await import("../src/lib/conversation");

  const msg =
    "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";
  const intel = runConversationIntelligence({ message: msg, goal: "What are my options?" });
  const view = composeAssistantView(intel, msg);
  assert.ok(view.some((s) => s.type === "branches"));
  assert.ok(view.some((s) => s.type === "ask" || s.type === "disclaimer"));
  assert.ok(view.some((s) => s.type === "disclaimer"));

  const reply = composeAssistantReply(intel, msg);
  assert.doesNotMatch(reply, /\*\*|__/);
  assert.match(decisionFocusLabel("identify_available_pathways"), /pathways/i);
  assert.match(decisionFocusLabel("explain_document_or_notice"), /notice/i);

  assert.ok(STARTER_PROMPTS.length >= 3);
  assert.ok(STARTER_PROMPTS.some((p) => /CP2000/i.test(p)));
  assert.ok(STARTER_PROMPTS.some((p) => /can't pay|cannot pay/i.test(p)));

  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  assert.match(schema, /model QaThread[\s\S]*intelligenceJson/);

  const migration = readFileSync(
    join(root, "prisma/migrations/20260907090000_package_j_qa_intelligence/migration.sql"),
    "utf8",
  );
  assert.match(migration, /intelligenceJson/);

  const qaChat = readFileSync(join(root, "src/components/qa-chat.tsx"), "utf8");
  assert.match(qaChat, /STARTER_PROMPTS/);
  assert.match(qaChat, /Working on/);
  assert.match(qaChat, /defaultQuestion/);
  assert.match(qaChat, /Continue with my situation/);
  assert.match(qaChat, /Track this government case/);

  const userAction = readFileSync(join(root, "src/actions/user.ts"), "utf8");
  assert.match(userAction, /priorContractFromStored/);
  assert.match(userAction, /intelligenceJson/);

  const qaPage = readFileSync(join(root, "src/app/app/qa/page.tsx"), "utf8");
  assert.match(qaPage, /searchParams/);
  assert.match(qaPage, /defaultQuestion/);

  const qaThread = readFileSync(join(root, "src/app/app/qa/[id]/page.tsx"), "utf8");
  assert.match(qaThread, /decisionFocusLabel/);
  assert.match(qaThread, /parseStoredIntelligence/);

  const guide = readFileSync(join(root, "src/lib/guide.ts"), "utf8");
  assert.match(guide, /\/app\/qa\?q=/);

  const assistantReply = readFileSync(join(root, "src/components/assistant-reply.tsx"), "utf8");
  assert.match(assistantReply, /AssistantReplyBlocks/);

  const caseAnswer = readFileSync(join(root, "src/components/case-answer-first.tsx"), "utf8");
  assert.match(caseAnswer, /caseMustAnswerBeforeClarify/);
  assert.match(caseAnswer, /AssistantReplyBlocks/);

  const casePage = readFileSync(join(root, "src/app/app/cases/[id]/page.tsx"), "utf8");
  assert.match(casePage, /CaseAnswerFirstPanel/);

  const situation = readFileSync(join(root, "src/components/situation-workspace-view.tsx"), "utf8");
  assert.match(situation, /AssistantReplyBlocks/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-J-PIPELINE-A-UX.md"), "utf8"),
    /Package J/i,
  );

  console.log("phase-package-j-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
