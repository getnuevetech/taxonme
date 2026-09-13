/**
 * Package AT — CP515 / CP518 Pipeline A composer honesty.
 * Run: npx tsx scripts/phase-package-at-check.ts
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

  const cp515 = "What is a CP515?";
  const cp515Reply = composeAssistantReply(
    runConversationIntelligence({ message: cp515, goal: "Explain" }),
    cp515,
  );
  assert.match(cp515Reply, /CP515|unfiled/i);
  assert.match(cp515Reply, /Account Transcript|SFR|Wage/i);
  assert.doesNotMatch(cp515Reply, PLAYBOOK_RE);
  assert.doesNotMatch(cp515Reply, GENERIC_SHELL_RE);
  assert.doesNotMatch(cp515Reply, /Form\s*12153/i);
  assert.doesNotMatch(cp515Reply, /Pathways that usually matter/i);

  const cp518 = "What is a CP518?";
  const cp518Reply = composeAssistantReply(
    runConversationIntelligence({ message: cp518, goal: "Explain" }),
    cp518,
  );
  assert.match(cp518Reply, /CP518|unfiled/i);
  assert.match(cp518Reply, /Account Transcript|SFR|CP515/i);
  assert.doesNotMatch(cp518Reply, PLAYBOOK_RE);
  assert.doesNotMatch(cp518Reply, GENERIC_SHELL_RE);
  assert.doesNotMatch(cp518Reply, /Form\s*12153/i);
  assert.doesNotMatch(cp518Reply, /Pathways that usually matter/i);

  for (const got of ["I got a CP515", "I got a CP518"]) {
    const gotView = composeAssistantView(
      runConversationIntelligence({ message: got, goal: "Help" }),
      got,
    );
    const gotPara = gotView
      .filter((s) => s.type === "paragraph")
      .map((s) => (s.type === "paragraph" ? s.text : ""))
      .join("\n");
    assert.doesNotMatch(gotPara, /payment or relief pathways/i);
  }

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
  assert.match(composer, /Package AT/);
  assert.match(composer, /unfiledReturn/);
  assert.ok(composer.includes("cp\\s?-?515"));
  assert.ok(composer.includes("cp\\s?-?518"));

  const branch = readFileSync(join(root, "src/lib/conversation/branch-analysis.ts"), "utf8");
  assert.match(branch, /CP515/);
  assert.match(branch, /CP518/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AT-CP515-COMPOSER-HONESTY.md"), "utf8"),
    /Package AT/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AT\*\*.*CP515|composer/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-at"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-at/);

  console.log("phase-package-at-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
