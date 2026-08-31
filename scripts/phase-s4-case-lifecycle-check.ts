/**
 * Wave 5 / Phase S4 — Case = agency matter only; legacy reclassify rules.
 * Run: npx tsx scripts/phase-s4-case-lifecycle-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runConversationIntelligence } from "../src/lib/conversation";
import { decideLegacyCaseDisposition } from "../src/lib/situation-reclassify";

const OPTIONS =
  "I owe the IRS for 2022 and cannot pay the full balance. What are my options before I file anything?";

{
  const intel = runConversationIntelligence({ message: OPTIONS, goal: "options" });
  assert.equal(intel.route.workspace, "situation");
  assert.equal(intel.route.invokes_case_engine, false);
}

{
  const intel = runConversationIntelligence({
    message:
      "Review my entire pending CP2000 for tax year 2023 notice number 12345, identify risks, and tell me what I should do next.",
  });
  assert.equal(intel.route.existing_government_case, true);
  assert.equal(intel.route.invokes_case_engine, true);
  assert.equal(intel.route.workspace, "existing_case");
}

{
  const intel = runConversationIntelligence({
    message: "I got CP503 notice number 99887. What does this notice mean?",
    documentCount: 1,
    documentHints: ["cp503.pdf"],
  });
  assert.equal(intel.route.existing_government_case, true);
  assert.equal(intel.route.invokes_case_engine, false);
}

{
  const d = decideLegacyCaseDisposition({
    id: "c1",
    number: 7,
    title: "options",
    situation: OPTIONS,
    goal: "What are my options?",
  });
  assert.equal(d.action, "reclassify_to_situation");
}

{
  const d = decideLegacyCaseDisposition({
    id: "c2",
    number: 8,
    title: "CP2000 pending",
    situation: "My CP2000 notice number 12345 is pending. Status under review.",
    goal: "Track my case",
    notices: [{ noticeType: "CP2000" }],
  });
  assert.equal(d.action, "keep_case");
  assert.ok(d.governmentSystems.includes("irs"));
}

{
  const d = decideLegacyCaseDisposition({
    id: "c3",
    number: 9,
    title: "unclear",
    situation: "Need help with tax paperwork for my family.",
    goal: "Understand next steps",
  });
  assert.equal(d.action, "reclassify_to_situation");
}

{
  const root = process.cwd();
  const apply = readFileSync(join(root, "src/lib/situation-reclassify-apply.ts"), "utf8");
  assert.ok(apply.includes("legacyCaseId"));
  assert.ok(apply.includes("reclassified_to_situation"));
  assert.ok(!apply.includes("runCaseAnalysis("), "reclassify must not run Case analysis");

  const actions = readFileSync(join(root, "src/actions/case.ts"), "utf8");
  assert.ok(actions.includes("invokes_case_engine"));
  assert.ok(actions.includes("governmentSystem"));

  const cli = readFileSync(join(root, "scripts/reclassify-legacy-cases.ts"), "utf8");
  assert.ok(cli.includes("--apply"));

  const guide = readFileSync(join(root, "src/lib/guide.ts"), "utf8");
  assert.ok(guide.includes("Track this government case") || guide.includes("Continue with my situation"));
}

console.log("phase-s4-case-lifecycle-check: ok");
