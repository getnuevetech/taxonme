/**
 * Package AP — CP501 / CP504 Pipeline A composer honesty.
 * Run: npx tsx scripts/phase-package-ap-check.ts
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

  const cp501 = "What is a CP501?";
  const cp501Reply = composeAssistantReply(
    runConversationIntelligence({ message: cp501, goal: "Explain" }),
    cp501,
  );
  assert.match(cp501Reply, /CP501|early reminder|unpaid/i);
  assert.match(cp501Reply, /Account Transcript|CP503|CP504|LT11/i);
  assert.doesNotMatch(cp501Reply, PLAYBOOK_RE);
  assert.doesNotMatch(cp501Reply, GENERIC_SHELL_RE);
  assert.doesNotMatch(cp501Reply, /Pathways that usually matter/i);

  const cp504 = "What is a CP504?";
  const cp504Reply = composeAssistantReply(
    runConversationIntelligence({ message: cp504, goal: "Explain" }),
    cp504,
  );
  assert.match(cp504Reply, /CP504|urgent|levy/i);
  assert.match(cp504Reply, /Account Transcript|LT11|Letter 1058/i);
  assert.doesNotMatch(cp504Reply, PLAYBOOK_RE);
  assert.doesNotMatch(cp504Reply, GENERIC_SHELL_RE);
  assert.doesNotMatch(cp504Reply, /Pathways that usually matter/i);

  const got501 = "I got a CP501";
  const got501View = composeAssistantView(
    runConversationIntelligence({ message: got501, goal: "Help" }),
    got501,
  );
  const got501Para = got501View
    .filter((s) => s.type === "paragraph")
    .map((s) => (s.type === "paragraph" ? s.text : ""))
    .join("\n");
  assert.doesNotMatch(got501Para, /payment or relief pathways/i);

  const got504 = "I got a CP504";
  const got504View = composeAssistantView(
    runConversationIntelligence({ message: got504, goal: "Help" }),
    got504,
  );
  const got504Para = got504View
    .filter((s) => s.type === "paragraph")
    .map((s) => (s.type === "paragraph" ? s.text : ""))
    .join("\n");
  assert.doesNotMatch(got504Para, /payment or relief pathways/i);

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
  assert.match(composer, /Package AP/);
  assert.match(composer, /collectionLadder/);
  assert.ok(composer.includes("cp\\s?-?501"));
  assert.ok(composer.includes("cp\\s?-?504"));

  const branch = readFileSync(join(root, "src/lib/conversation/branch-analysis.ts"), "utf8");
  assert.match(branch, /CP501/);
  assert.match(branch, /CP504/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AP-CP501-CP504-COMPOSER-HONESTY.md"), "utf8"),
    /Package AP/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AP\*\*.*CP501|CP504|composer/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ap"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ap/);

  console.log("phase-package-ap-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
