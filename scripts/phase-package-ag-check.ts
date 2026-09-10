/**
 * Package AG — Pipeline A evidence-first chrome honesty.
 * Run: npx tsx scripts/phase-package-ag-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const THIN =
  "I owe IRS some money but I am not sure how much and what I need to do.";

async function main() {
  const root = process.cwd();
  const { runConversationIntelligence } = await import("../src/lib/conversation");
  const { composeAssistantView, composeAssistantReply } = await import(
    "../src/lib/conversation/assistant-composer"
  );
  const { STARTER_PROMPTS } = await import("../src/lib/conversation/starter-prompts");

  const intel = runConversationIntelligence({ message: THIN, goal: "what should I do?" });
  assert.ok(intel.strategy.branches.every((b) =>
    b.id === "establish_account_position" || b.id === "use_existing_notice",
  ));

  const view = composeAssistantView(intel, THIN);
  const branchSection = view.find((s) => s.type === "branches");
  assert.ok(branchSection && branchSection.type === "branches");
  assert.equal(branchSection.intro, "What usually helps next");
  assert.notEqual(branchSection.intro, "Pathways that usually matter");

  const askSection = view.find((s) => s.type === "ask");
  if (askSection && askSection.type === "ask") {
    assert.doesNotMatch(askSection.question, /which pathway applies/i);
  }

  const reply = composeAssistantReply(intel, THIN);
  assert.doesNotMatch(reply, /Pathways that usually matter/i);
  assert.doesNotMatch(reply, /which pathway applies to you/i);
  assert.doesNotMatch(reply, /payment plans or hardship status/i);
  assert.doesNotMatch(reply, /Form 9465|\$50,?000|Offer in Compromise/i);

  const rich =
    "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";
  const richIntel = runConversationIntelligence({ message: rich, goal: "What are my options?" });
  const richView = composeAssistantView(richIntel, rich);
  const richBranches = richView.find((s) => s.type === "branches");
  assert.ok(richBranches && richBranches.type === "branches");
  assert.equal(richBranches.intro, "Pathways that usually matter");

  assert.ok(STARTER_PROMPTS.length >= 3);
  assert.ok(STARTER_PROMPTS.some((p) => /CP2000/i.test(p)));
  assert.ok(STARTER_PROMPTS.some((p) => /can't pay|cannot pay/i.test(p)));
  assert.equal(
    STARTER_PROMPTS.some((p) => /what can I do\?/i.test(p)),
    false,
    "starters must not invite a mechanism menu",
  );
  for (const prompt of STARTER_PROMPTS) {
    assert.doesNotMatch(
      prompt,
      /payment plan|form\s*9465|offer in compromise|installment agreement/i,
      `starter must not name a mechanism: ${prompt}`,
    );
  }

  const composerSrc = readFileSync(
    join(root, "src/lib/conversation/assistant-composer.ts"),
    "utf8",
  );
  assert.match(composerSrc, /isEvidenceFirstBranch|What usually helps next/);
  assert.match(composerSrc, /Package AG/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AG-PIPELINE-A-EVIDENCE-CHROME-HONESTY.md"), "utf8"),
    /Package AG/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AG\*\*.*evidence-first chrome|Pipeline A evidence/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ag"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ag/);

  console.log("phase-package-ag-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
