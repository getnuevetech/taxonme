/**
 * Package AV — CP2501 Pipeline A composer honesty.
 * Run: npx tsx scripts/phase-package-av-check.ts
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

  const cp2501 = "What is a CP2501?";
  const cp2501Reply = composeAssistantReply(
    runConversationIntelligence({ message: cp2501, goal: "Explain" }),
    cp2501,
  );
  assert.match(cp2501Reply, /CP2501|underreporter|soft|mismatch|earlier/i);
  assert.match(cp2501Reply, /Account Transcript|Wage|CP2000|CP3219A/i);
  assert.doesNotMatch(cp2501Reply, PLAYBOOK_RE);
  assert.doesNotMatch(cp2501Reply, GENERIC_SHELL_RE);
  assert.doesNotMatch(cp2501Reply, /Form\s*12153/i);
  assert.doesNotMatch(cp2501Reply, /Pathways that usually matter/i);

  // CP2000 path still identify-first (AJ).
  const cp2000 = "What is a CP2000?";
  const cp2000Reply = composeAssistantReply(
    runConversationIntelligence({ message: cp2000, goal: "Explain" }),
    cp2000,
  );
  assert.match(cp2000Reply, /CP2000|underreporter|proposed/i);
  assert.doesNotMatch(cp2000Reply, GENERIC_SHELL_RE);

  const got = "I got a CP2501";
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
  assert.match(composer, /Package AV/);
  assert.ok(composer.includes("cp\\s?-?2501"));

  const branch = readFileSync(join(root, "src/lib/conversation/branch-analysis.ts"), "utf8");
  assert.match(branch, /CP2501/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AV-CP2501-COMPOSER-HONESTY.md"), "utf8"),
    /Package AV/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AV\*\*.*CP2501|composer/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-av"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-av/);

  console.log("phase-package-av-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
