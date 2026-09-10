/**
 * Package AN — Ability-to-pay vs 433 depth labeling honesty.
 * Run: npx tsx scripts/phase-package-an-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const root = process.cwd();

  const formsPage = readFileSync(join(root, "src/app/app/forms/page.tsx"), "utf8");
  assert.doesNotMatch(formsPage, /assemble the real form/i);
  assert.match(formsPage, /abbreviated draft|official IRS form/i);

  const home = readFileSync(join(root, "src/app/page.tsx"), "utf8");
  assert.doesNotMatch(home, /regenerate the completed standard form/i);
  assert.doesNotMatch(home, /friendly quizzes/i);
  assert.match(home, /abbreviated draft/i);

  const branch = readFileSync(join(root, "src/lib/conversation/branch-analysis.ts"), "utf8");
  assert.doesNotMatch(branch, /proving financial hardship/i);
  assert.match(branch, /ability-to-pay|allowable living/i);
  assert.match(branch, /Form 433|CIS/);

  const { runConversationIntelligence } = await import("../src/lib/conversation");
  const { composeAssistantReply } = await import("../src/lib/conversation/assistant-composer");

  const rich =
    "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";
  const richIntel = runConversationIntelligence({ message: rich, goal: "What are my options?" });
  assert.ok(richIntel.strategy.branches.some((b) => b.id === "currently_not_collectible"));
  const cnc = richIntel.strategy.branches.find((b) => b.id === "currently_not_collectible");
  assert.ok(cnc);
  assert.doesNotMatch(cnc.explanation, /proving financial hardship/i);
  assert.match(cnc.explanation, /ability-to-pay|allowable living/i);
  assert.match(cnc.explanation, /Form 433|CIS/);

  const richReply = composeAssistantReply(richIntel, rich);
  assert.match(richReply, /Pathways that usually matter/i);
  assert.doesNotMatch(richReply, /proving financial hardship/i);

  const thin = "I cannot pay the IRS";
  const thinReply = composeAssistantReply(
    runConversationIntelligence({ message: thin, goal: "what should I do?" }),
    thin,
  );
  assert.match(thinReply, /What usually helps next/i);
  assert.doesNotMatch(thinReply, /Pathways that usually matter/i);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AN-ATP-433-DEPTH-LABELING-HONESTY.md"), "utf8"),
    /Package AN/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AN\*\*.*433|ability-to-pay|ATP/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-an"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-an/);

  console.log("phase-package-an-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
