/**
 * Package E — evidence-proportional UI / presentation depth.
 * Run: npx tsx scripts/phase-package-e-check.ts
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
  const {
    isThinCustomerPresentation,
    shouldShowAnalysisOutline,
    shouldShowHowWeReached,
    shouldShowPathForwardSection,
    filterPathStepsForDepth,
    documentChecklistLimit,
  } = await import("../src/lib/presentation-depth");
  const { thinBalanceDueFinding } = await import("../src/lib/ai/evidence-proportional");
  const { fallbackAnalyze } = await import("../src/lib/ai/fallback");
  const { thinEvidencePathSteps } = await import("../src/lib/path-from-analysis");

  const thinEv = {
    hasDocs: false,
    hasTranscript: false,
    hasNotice: false,
    hasAmount: false,
    hasTaxYear: false,
  };
  assert.equal(isThinCustomerPresentation(thinEv), true);
  assert.equal(shouldShowAnalysisOutline(thinEv), false);
  assert.equal(shouldShowHowWeReached(thinEv), false);
  assert.equal(documentChecklistLimit(thinEv), 2);

  assert.equal(
    isThinCustomerPresentation({
      ...thinEv,
      hasTranscript: true,
      hasAmount: true,
    }),
    false,
  );
  assert.equal(
    shouldShowAnalysisOutline({
      ...thinEv,
      hasTranscript: true,
      hasAmount: true,
    }),
    true,
  );

  const filtered = filterPathStepsForDepth(
    [
      ...thinEvidencePathSteps({ hasDocs: false, hasTranscript: false }),
      {
        title: "Confirm the resolution with the IRS",
        description: "After payment",
        action_key: "",
      },
      {
        title: "Prepare a payment plan request (Form 9465)",
        description: "installment",
        action_key: "COMPLETE_FORM_9465",
      },
    ],
    thinEv,
  );
  assert.equal(filtered.some((s) => /confirm the resolution|9465|penalty/i.test(s.title)), false);
  assert.equal(shouldShowPathForwardSection(filtered.length), true);
  assert.equal(shouldShowPathForwardSection(0), false);

  const finding = thinBalanceDueFinding({
    year: null,
    hasDocs: false,
    docCount: 0,
    guidance: { what: "x", action: "UPLOAD_DOCUMENTS", state: "info_needed" },
    evidenceLine: "No documents are on file yet.",
  });
  assert.deepEqual(finding.analysis_outline, []);
  assert.deepEqual(finding.explanations, []);

  const result = await fallbackAnalyze(
    "I owe IRS some money but I am not sure how much and what I need to do.",
    "I need to know what I owe and what to do.",
    "",
    [],
  );
  assert.equal(result.pathSteps.some((s) => /confirm the resolution/i.test(s.title)), false);
  assert.equal(result.pathSteps.some((s) => /9465|penalty relief/i.test(s.title)), false);
  for (const issue of result.issues) {
    const outline = Array.isArray(issue.analysis_outline) ? issue.analysis_outline : [];
    if (String(issue.issue_type) === "balance_due" && String(issue.item_kind) === "missing_info") {
      assert.equal(outline.length, 0, "thin balance_due finding must omit outline");
    }
  }

  const root = process.cwd();
  const view = readFileSync(join(root, "src/components/case-analysis-view.tsx"), "utf8");
  assert.match(view, /shouldShowAnalysisOutline/);
  assert.match(view, /shouldShowHowWeReached/);
  assert.match(view, /showPathForward/);
  assert.match(view, /filterPathStepsForDepth/);
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-E-PROPORTIONAL-UI.md"), "utf8"),
    /Package E/i,
  );

  console.log("phase-package-e-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
