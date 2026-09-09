/**
 * Package O — Presenter honesty (thin intake sanitize + prompt supersede).
 * Run: npx tsx scripts/phase-package-o-check.ts
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
  const { sanitizeThinPresenterIssues, isThinPresenterEvidence } = await import(
    "../src/lib/ai/presenter-honesty"
  );
  const { applyTranscriptDeepening } = await import("../src/lib/ai/transcript-deepen");
  const { shouldShowExplanations } = await import("../src/lib/presentation-depth");
  const { PROMPT_SUPERSEDES } = await import("../src/lib/ai/v3-prompts");

  const thinEv = {
    hasDocs: false,
    hasTranscript: false,
    hasAmount: false,
    hasTaxYear: false,
  };
  assert.equal(isThinPresenterEvidence(thinEv), true);

  const speculative = {
    issue_type: "balance_due",
    item_kind: "issue",
    evidence_status: "possible",
    title: "You may qualify for First-Time Abatement and an installment agreement",
    what_we_know: "You owe the IRS; First-Time Abatement and installment agreement may help above $50,000.",
    our_conclusion: "Pursue penalty relief and a payment plan.",
    explanations: [{ title: "Cash-flow shortfall", detail: "Guess", likelihood: "Likely" }],
    analysis_outline: [{ heading: "Tax rules", detail: "Generic FTA" }],
    expected_amount: null,
    confidence: "medium",
  };

  const thin = sanitizeThinPresenterIssues([speculative], thinEv);
  assert.equal(thin.sanitized, true);
  assert.equal(thin.issues[0].item_kind, "missing_info");
  assert.equal(thin.issues[0].evidence_status, "needs_verification");
  assert.deepEqual(thin.issues[0].explanations, []);
  assert.deepEqual(thin.issues[0].analysis_outline, []);
  assert.doesNotMatch(String(thin.issues[0].what_we_know), /First-Time Abatement|installment|\$50,?000/i);

  const richEv = {
    hasDocs: true,
    hasTranscript: true,
    hasAmount: true,
    hasTaxYear: true,
  };
  const richKeep = sanitizeThinPresenterIssues(
    [
      {
        issue_type: "balance_due",
        item_kind: "finding",
        evidence_status: "confirmed",
        title: "2023 balance due",
        what_we_know: "Transcript shows $2,879.",
        explanations: [{ title: "FTP penalty", detail: "Code 276", likelihood: "Likely" }],
        analysis_outline: [{ heading: "Your evidence", detail: "Account Transcript" }],
        expected_amount: 2879,
      },
    ],
    richEv,
  );
  assert.equal(richKeep.sanitized, false);
  assert.equal((richKeep.issues[0].explanations as unknown[]).length, 1);

  const deep = applyTranscriptDeepening({
    issues: [speculative],
    transcriptText: TRANSCRIPT,
    hasDocs: true,
  });
  assert.equal(deep.deepened, true);
  const afterDeep = sanitizeThinPresenterIssues(deep.issues as Record<string, unknown>[], {
    hasDocs: true,
    hasTranscript: true,
    hasAmount: true,
    hasTaxYear: true,
  });
  assert.equal(afterDeep.issues[0].evidence_status, "confirmed");
  assert.equal(afterDeep.issues[0].expected_amount, 2879);

  assert.equal(shouldShowExplanations({ hasTranscript: false, hasAmount: false }), false);
  assert.equal(shouldShowExplanations({ hasTranscript: true, hasAmount: true }), true);

  assert.equal(PROMPT_SUPERSEDES["RESP-PRES-v3"], "RESP-PRES-v31");
  assert.equal(PROMPT_SUPERSEDES["PRES-OVERLAY-v3"], "PRES-OVERLAY-v31");
  assert.equal(PROMPT_SUPERSEDES["SCHEMA-PRES-v3"], "SCHEMA-PRES-v31");

  const prompts = readFileSync(join(root, "src/lib/ai/v3-prompts.ts"), "utf8");
  assert.match(prompts, /RESP-PRES-v31/);
  assert.match(prompts, /evidence-proportional honesty/i);
  assert.match(prompts, /promptId: "RESP-PRES-v31"/);

  const orch = readFileSync(join(root, "src/lib/ai/orchestrator.ts"), "utf8");
  assert.match(orch, /sanitizeThinPresenterIssues/);
  assert.match(orch, /Package O/);

  const ui = readFileSync(join(root, "src/components/case-analysis-view.tsx"), "utf8");
  assert.match(ui, /shouldShowExplanations/);
  assert.match(ui, /showExplanations && explanations/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-O-PRESENTER-HONESTY.md"), "utf8"),
    /Package O/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*O\*\*.*Presenter|Presenter honesty/i,
  );

  console.log("phase-package-o-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
