/**
 * Package AJ — Pipeline A notice/exam chrome honesty.
 * Run: npx tsx scripts/phase-package-aj-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const root = process.cwd();
  const { runConversationIntelligence } = await import("../src/lib/conversation");
  const {
    composeAssistantView,
    composeAssistantReply,
    decisionFocusLabel,
    decisionFocusLabelFromIntel,
  } = await import("../src/lib/conversation/assistant-composer");

  const cp2000 = "What is a CP2000?";
  const cpIntel = runConversationIntelligence({ message: cp2000, goal: "Explain" });
  const cpReply = composeAssistantReply(cpIntel, cp2000);
  assert.doesNotMatch(cpReply, /agree, partially agree, or disagree/i);
  assert.doesNotMatch(cpReply, /Pathways that usually matter/i);
  assert.match(cpReply, /underreporter|proposed/i);
  assert.match(cpReply, /Wage|Account Transcript|transcript/i);

  const cpView = composeAssistantView(cpIntel, cp2000);
  const cpBranches = cpView.find((s) => s.type === "branches");
  if (cpBranches && cpBranches.type === "branches") {
    assert.equal(cpBranches.intro, "What usually helps next");
    assert.ok(
      cpBranches.branches.every(
        (b) => b.id === "respond_by_deadline" || b.id === "verify_irs_figures",
      ),
    );
  }

  const thinCantPay = "I cannot pay the IRS";
  const thinIntel = runConversationIntelligence({
    message: thinCantPay,
    goal: "what should I do?",
  });
  assert.ok(
    thinIntel.strategy.branches.every(
      (b) => b.id === "establish_account_position" || b.id === "use_existing_notice",
    ),
  );
  const thinFocus = decisionFocusLabelFromIntel(thinIntel);
  assert.doesNotMatch(thinFocus, /pathways may be available/i);
  assert.match(thinFocus, /confirm|account/i);

  // Default label (no opts) still pathway-worded for Package J.
  assert.match(decisionFocusLabel("identify_available_pathways"), /pathways/i);

  const gotCp2000 = "I got a CP2000";
  const gotIntel = runConversationIntelligence({ message: gotCp2000, goal: "Help" });
  const gotView = composeAssistantView(gotIntel, gotCp2000);
  const gotPara = gotView
    .filter((s) => s.type === "paragraph")
    .map((s) => (s.type === "paragraph" ? s.text : ""))
    .join("\n");
  assert.doesNotMatch(gotPara, /payment or relief pathways/i);

  const rich =
    "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";
  const richIntel = runConversationIntelligence({ message: rich, goal: "What are my options?" });
  const richView = composeAssistantView(richIntel, rich);
  const richBranches = richView.find((s) => s.type === "branches");
  assert.ok(richBranches && richBranches.type === "branches");
  assert.equal(richBranches.intro, "Pathways that usually matter");
  assert.match(decisionFocusLabelFromIntel(richIntel), /pathways/i);

  const qaPage = readFileSync(join(root, "src/app/app/qa/[id]/page.tsx"), "utf8");
  assert.match(qaPage, /decisionFocusLabelFromIntel/);

  const composer = readFileSync(join(root, "src/lib/conversation/assistant-composer.ts"), "utf8");
  assert.match(composer, /isNoticeExamBranch|Package AJ/);
  assert.doesNotMatch(composer, /You can agree, partially agree, or disagree/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AJ-PIPELINE-A-NOTICE-EXAM-CHROME-HONESTY.md"), "utf8"),
    /Package AJ/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AJ\*\*.*notice\/exam chrome|Pipeline A notice/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-aj"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-aj/);

  console.log("phase-package-aj-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
