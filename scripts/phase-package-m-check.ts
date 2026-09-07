/**
 * Package M — Admin ConversationIntelligence diagnostics.
 * Run: npx tsx scripts/phase-package-m-check.ts
 */
import Module from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

async function main() {
  const root = process.cwd();
  const {
    summarizeConversationIntelligence,
    summarizeFromStoredJson,
    summarizeForCase,
    runConversationIntelligence,
  } = await import("../src/lib/conversation");

  const thin =
    "I owe IRS some money but I am not sure how much and what I need to do.";
  const intel = runConversationIntelligence({ message: thin, goal: thin });
  const summary = summarizeConversationIntelligence(intel, "stored");
  assert.ok(summary.decision_target);
  assert.ok(summary.response_mode);
  assert.ok(summary.pipeline);
  assert.ok(summary.workspace);
  assert.equal(summary.source, "stored");
  assert.ok(Array.isArray(summary.ask_now));
  assert.ok(Array.isArray(summary.questions_suppressed));

  const raw = JSON.stringify(intel);
  const fromStored = summarizeFromStoredJson(raw);
  assert.ok(fromStored);
  assert.equal(fromStored!.decision_target, summary.decision_target);
  assert.equal(summarizeFromStoredJson(null), null);
  assert.equal(summarizeFromStoredJson("{"), null);

  const caseStored = summarizeForCase({
    situation: thin,
    goal: thin,
    intelligenceJson: raw,
  });
  assert.equal(caseStored.source, "stored");

  const caseRecomputed = summarizeForCase({
    situation: thin,
    goal: thin,
    intelligenceJson: null,
  });
  assert.equal(caseRecomputed.source, "recomputed");
  assert.ok(caseRecomputed.decision_target);

  const { emptySummaryProbe } = await import("../src/lib/admin/intelligence-lookup");
  const probe = emptySummaryProbe();
  assert.equal(probe.source, "recomputed");
  assert.equal(probe.decision_target, "identify_available_pathways");

  assert.match(
    readFileSync(join(root, "src/app/admin/intelligence/page.tsx"), "utf8"),
    /lookupIntelligenceDiagnostics/,
  );
  assert.match(
    readFileSync(join(root, "src/app/admin/layout.tsx"), "utf8"),
    /\/admin\/intelligence/,
  );
  assert.match(
    readFileSync(join(root, "src/app/admin/cases/[id]/page.tsx"), "utf8"),
    /IntelligenceDiagnosticsPanel/,
  );
  assert.match(
    readFileSync(join(root, "src/components/admin/intelligence-diagnostics-panel.tsx"), "utf8"),
    /ask_now/,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-M-ADMIN-INTELLIGENCE-DIAGNOSTICS.md"), "utf8"),
    /Package M/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*M\*\*.*ConversationIntelligence|Admin.*intelligence/i,
  );

  console.log("phase-package-m-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
