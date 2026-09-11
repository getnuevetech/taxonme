/**
 * Package AR — CP90 Pipeline A composer honesty.
 * Run: npx tsx scripts/phase-package-ar-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PLAYBOOK_RE =
  /installment\s+agreement|form\s*9465|payment\s+plan|offer\s+in\s+compromise|\bOIC\b|currently[\s-]?not[\s-]?collectible|\bCNC\b|\$\s?50,?000/i;
const GENERIC_SHELL_RE = /I can explain the notice you referenced/i;

async function main() {
  const root = process.cwd();
  const { runConversationIntelligence } = await import("../src/lib/conversation");
  const { composeAssistantView, composeAssistantReply } = await import(
    "../src/lib/conversation/assistant-composer"
  );

  const cp90 = "What is a CP90?";
  const cp90Reply = composeAssistantReply(
    runConversationIntelligence({ message: cp90, goal: "Explain" }),
    cp90,
  );
  assert.match(cp90Reply, /CP90|ACS|Automated Collection/i);
  assert.match(cp90Reply, /Account Transcript|LT11|Letter 1058|CDP/i);
  assert.doesNotMatch(cp90Reply, PLAYBOOK_RE);
  assert.doesNotMatch(cp90Reply, GENERIC_SHELL_RE);
  assert.doesNotMatch(cp90Reply, /Pathways that usually matter/i);

  const got = "I got a CP90";
  const gotView = composeAssistantView(
    runConversationIntelligence({ message: got, goal: "Help" }),
    got,
  );
  const gotPara = gotView
    .filter((s) => s.type === "paragraph")
    .map((s) => (s.type === "paragraph" ? s.text : ""))
    .join("\n");
  assert.doesNotMatch(gotPara, /payment or relief pathways/i);

  const thin = "I cannot pay the IRS";
  const thinReply = composeAssistantReply(
    runConversationIntelligence({ message: thin, goal: "what should I do?" }),
    thin,
  );
  assert.match(thinReply, /What usually helps next/i);
  assert.doesNotMatch(thinReply, /Pathways that usually matter/i);

  const rich =
    "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";
  const richView = composeAssistantView(
    runConversationIntelligence({ message: rich, goal: "What are my options?" }),
    rich,
  );
  const richBranches = richView.find((s) => s.type === "branches");
  assert.ok(richBranches && richBranches.type === "branches");
  assert.equal(richBranches.intro, "Pathways that usually matter");

  const composer = readFileSync(join(root, "src/lib/conversation/assistant-composer.ts"), "utf8");
  assert.match(composer, /Package AR/);
  assert.match(composer, /finalLevyAcs/);
  assert.ok(composer.includes("cp\\s?-?90"));

  const branch = readFileSync(join(root, "src/lib/conversation/branch-analysis.ts"), "utf8");
  assert.match(branch, /CP90/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AR-CP90-COMPOSER-HONESTY.md"), "utf8"),
    /Package AR/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AR\*\*.*CP90|composer/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ar"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ar/);

  console.log("phase-package-ar-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
