/**
 * Package L — AI-path transcript deepen (presenter issues + orchestrator wire).
 * Run: npx tsx scripts/phase-package-l-check.ts
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

const TRANSCRIPT = `ACCOUNT TRANSCRIPT
TAX PERIOD ENDING: Dec. 31, 2023
ACCOUNT BALANCE: 2,879.00
AS OF: Mar. 10, 2026
150 Tax return filed 04-15-2024 $5,000.00
276 Failure to pay tax penalty 06-15-2024 $120.00
196 Interest assessed 06-15-2024 $45.50`;

async function main() {
  const root = process.cwd();
  const { applyTranscriptDeepening, deepenedBalanceDueFinding } = await import(
    "../src/lib/ai/transcript-deepen"
  );
  const { thinBalanceDueFinding } = await import("../src/lib/ai/evidence-proportional");
  const { parseTranscript } = await import("../src/lib/evidence/transcript");

  const thinIssue = thinBalanceDueFinding({
    year: null,
    hasDocs: false,
    docCount: 0,
    guidance: { state: "action_needed", action: "GET_TRANSCRIPT" },
    evidenceLine: "No documents yet.",
  }) as Record<string, unknown>;

  const speculativeAi = {
    issue_type: "balance_due",
    item_kind: "issue",
    evidence_status: "possible",
    title: "Possible balance due",
    what_we_know: "You may owe the IRS.",
    expected_amount: null,
    confidence: "low",
    analysis_outline: [{ heading: "Guess", detail: "speculative" }],
  };

  const noTx = applyTranscriptDeepening({
    issues: [thinIssue],
    transcriptText: "",
    hasDocs: false,
  });
  assert.equal(noTx.deepened, false);
  assert.equal(noTx.issues[0], thinIssue);

  const deepThin = applyTranscriptDeepening({
    issues: [thinIssue],
    transcriptText: TRANSCRIPT,
    hasDocs: true,
    evidenceLine: "account-transcript.pdf",
  });
  assert.equal(deepThin.deepened, true);
  assert.equal(deepThin.amount, 2879);
  assert.equal(deepThin.year, 2023);
  assert.equal(deepThin.issues[0].evidence_status, "confirmed");
  assert.equal(deepThin.issues[0].expected_amount, 2879);
  assert.match(String(deepThin.issues[0].what_we_know), /2,?879/);
  assert.match(String(deepThin.issues[0].what_we_know), /penalt/i);

  const deepAi = applyTranscriptDeepening({
    issues: [speculativeAi],
    transcriptText: TRANSCRIPT,
    hasDocs: true,
  });
  assert.equal(deepAi.deepened, true);
  assert.equal(deepAi.issues[0].evidence_status, "confirmed");
  assert.doesNotMatch(JSON.stringify(deepAi.issues[0].still_unclear), /How much is tax principal versus penalties/);

  const empty = applyTranscriptDeepening({
    issues: [],
    transcriptText: TRANSCRIPT,
    hasDocs: true,
  });
  assert.equal(empty.deepened, true);
  assert.equal(empty.issues.length, 1);
  assert.equal(empty.issues[0].issue_type, "balance_due");

  const tx = parseTranscript(TRANSCRIPT);
  const direct = deepenedBalanceDueFinding({
    amount: 2879,
    year: 2023,
    transcript: tx,
    evidenceLine: "tx",
    hasDocs: true,
  });
  assert.equal(direct.evidence_status, "confirmed");

  const orch = readFileSync(join(root, "src/lib/ai/orchestrator.ts"), "utf8");
  assert.match(orch, /applyTranscriptDeepening/);
  assert.match(orch, /Package L/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-L-AI-PATH-DEEPEN.md"), "utf8"),
    /Package L/i,
  );
  assert.match(
    readFileSync(join(root, "src/lib/ai/transcript-deepen.ts"), "utf8"),
    /applyTranscriptDeepening/,
  );

  console.log("phase-package-l-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
