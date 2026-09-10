/**
 * Package AM — Pipeline A lien / NFTL / Letter 3172 chrome honesty.
 * Run: npx tsx scripts/phase-package-am-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PLAYBOOK_RE =
  /installment\s+agreement|form\s*9465|payment\s+plan|offer\s+in\s+compromise|\bOIC\b|currently[\s-]?not[\s-]?collectible|\bCNC\b|\$\s?50,?000/i;

async function main() {
  const root = process.cwd();
  const { runConversationIntelligence } = await import("../src/lib/conversation");
  const { composeAssistantView, composeAssistantReply } = await import(
    "../src/lib/conversation/assistant-composer"
  );

  const letter = "What is IRS Letter 3172 about a federal tax lien?";
  const letterIntel = runConversationIntelligence({ message: letter, goal: "Explain" });
  const letterReply = composeAssistantReply(letterIntel, letter);
  assert.match(letterReply, /Letter 3172|NFTL|federal tax lien/i);
  assert.match(letterReply, /Account Transcript|Calendar|identify/i);
  assert.doesNotMatch(letterReply, PLAYBOOK_RE);
  assert.doesNotMatch(letterReply, /Pathways that usually matter/i);
  assert.doesNotMatch(letterReply, /I can explain the notice you referenced/i);

  const nftl = "What is a Notice of Federal Tax Lien (NFTL)?";
  const nftlReply = composeAssistantReply(
    runConversationIntelligence({ message: nftl, goal: "Explain" }),
    nftl,
  );
  assert.match(nftlReply, /NFTL|Notice of Federal Tax Lien/i);
  assert.match(nftlReply, /Account Transcript|Letter 3172/i);
  assert.doesNotMatch(nftlReply, PLAYBOOK_RE);
  assert.doesNotMatch(nftlReply, /Pathways that usually matter/i);

  const got = "I got a Letter 3172";
  const gotView = composeAssistantView(
    runConversationIntelligence({ message: got, goal: "Help" }),
    got,
  );
  const gotPara = gotView
    .filter((s) => s.type === "paragraph")
    .map((s) => (s.type === "paragraph" ? s.text : ""))
    .join("\n");
  assert.doesNotMatch(gotPara, /payment or relief pathways/i);
  assert.match(gotPara, /lien notice|Letter 3172|NFTL|Account Transcript/i);

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
  assert.match(composer, /Package AM|Letter 3172/);
  assert.match(composer, /lienNotice/);

  const branch = readFileSync(join(root, "src/lib/conversation/branch-analysis.ts"), "utf8");
  assert.match(branch, /Letter 3172/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AM-PIPELINE-A-LIEN-NFTL-CHROME-HONESTY.md"), "utf8"),
    /Package AM/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AM\*\*.*lien|NFTL|3172/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-am"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-am/);

  console.log("phase-package-am-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
