/**
 * Package F — thin intake → Account Transcript deepening.
 * Run: npx tsx scripts/phase-package-f-check.ts
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

const THIN =
  "I owe IRS some money but I am not sure how much and what I need to do.";
const GOAL = "I need to know what I owe and what to do.";

const TRANSCRIPT = `ACCOUNT TRANSCRIPT
TAX PERIOD ENDING: Dec. 31, 2023
ACCOUNT BALANCE: 2,879.00
AS OF: Mar. 10, 2026
150 Tax return filed 04-15-2024 $5,000.00
806 W-2 withholding 04-15-2024 -$7,879.00
826 Credit transferred out 05-01-2024 -$2,620.07
846 Refund issued 05-10-2024 -$427.93
276 Failure to pay tax penalty 06-15-2024 $120.00
196 Interest assessed 06-15-2024 $45.50`;

async function main() {
  const { fallbackAnalyze } = await import("../src/lib/ai/fallback");
  const { parseTranscript } = await import("../src/lib/evidence/transcript");
  const { isAccountTranscriptDoc, docKindFromDocumentType } = await import(
    "../src/lib/evidence/is-transcript"
  );
  const { deepenedBalanceDueFinding, penaltyInterestTotal } = await import(
    "../src/lib/ai/transcript-deepen"
  );
  const { resolutionEligibility } = await import("../src/lib/path-from-analysis");
  const { shouldNameFtaOrAep, shouldRetrieveInstallmentThresholds } = await import(
    "../src/lib/authority-gates"
  );
  const { isThinCustomerPresentation, shouldShowAnalysisOutline } = await import(
    "../src/lib/presentation-depth"
  );
  const { uploadDocumentsSatisfied } = await import("../src/lib/case-progress-core");

  // --- Thin stays thin ---
  const thin = await fallbackAnalyze(THIN, GOAL, "", []);
  assert.ok(thin.issues.some((i) => i.issue_type === "balance_due"));
  assert.equal(
    thin.issues.every((i) => !Array.isArray(i.explanations) || (i.explanations as unknown[]).length === 0),
    true,
  );
  assert.equal(thin.pathSteps.some((s) => /9465|penalty relief|\$50,000|first-time abatement/i.test(s.title)), false);
  const thinBalance = thin.issues.find((i) => i.issue_type === "balance_due")!;
  assert.equal(thinBalance.item_kind, "missing_info");
  assert.deepEqual(thinBalance.analysis_outline, []);

  // --- Transcript detection without docKind=transcript ---
  assert.equal(
    isAccountTranscriptDoc({
      docKind: "other",
      documentType: "IRS_ACCOUNT_TRANSCRIPT",
      fileName: "scan.pdf",
    }),
    true,
  );
  assert.equal(docKindFromDocumentType("IRS_ACCOUNT_TRANSCRIPT", "other"), "transcript");
  assert.equal(
    uploadDocumentsSatisfied(
      [{ docKind: "other", documentType: "IRS_ACCOUNT_TRANSCRIPT", fileName: "account.pdf" }],
      ["transcript", "notice"],
    ),
    true,
  );

  // --- Deepen after transcript text (even when kind is still "other") ---
  const deep = await fallbackAnalyze(THIN, GOAL, TRANSCRIPT, [
    { docKind: "other", readable: true, documentType: "", fileName: "account-transcript.pdf" },
  ]);
  const deepBalance = deep.issues.find((i) => i.issue_type === "balance_due");
  assert.ok(deepBalance, "deepened balance finding required");
  assert.equal(deepBalance!.item_kind, "issue");
  assert.equal(deepBalance!.evidence_status, "confirmed");
  assert.equal(deepBalance!.expected_amount, 2879);
  assert.equal(deepBalance!.tax_year, 2023);
  assert.ok(Array.isArray(deepBalance!.analysis_outline) && (deepBalance!.analysis_outline as unknown[]).length >= 3);
  assert.match(String(deepBalance!.what_we_know), /2,?879/);
  assert.match(String(deepBalance!.what_we_know), /penalt/i);
  assert.doesNotMatch(JSON.stringify(deepBalance!.still_unclear), /How much is tax principal versus penalties/);
  assert.equal(
    deep.pathSteps.some((s) => /9465|payment plan/i.test(s.title)),
    true,
    "installment path opens once amount known",
  );
  assert.doesNotMatch(JSON.stringify(deep), /\$50,000/);
  assert.ok(shouldNameFtaOrAep(2023));
  assert.equal(shouldNameFtaOrAep(null), false);

  const parsed = parseTranscript(TRANSCRIPT);
  assert.equal(parsed.accountBalance, 2879);
  assert.ok(parsed.penalties.length >= 2);
  assert.ok(penaltyInterestTotal(parsed) > 100);
  const deepened = deepenedBalanceDueFinding({
    amount: 2879,
    year: 2023,
    transcript: parsed,
    evidenceLine: "transcript on file",
    hasDocs: true,
  });
  assert.equal(deepened.evidence_status, "confirmed");
  assert.match(String(deepened.what_we_know), /276|196/);

  const elig = resolutionEligibility({
    hasDocs: true,
    hasTranscript: true,
    hasAmount: true,
    hasTaxYear: true,
    transcriptPenaltyCount: parsed.penalties.length,
  });
  assert.equal(elig.installment, true);
  assert.equal(elig.penaltyRelief, true);
  assert.equal(
    shouldRetrieveInstallmentThresholds({
      hasDocs: true,
      hasTranscript: true,
      hasAmount: true,
      hasTaxYear: true,
    }),
    true,
  );
  assert.equal(
    isThinCustomerPresentation({
      hasTranscript: true,
      hasAmount: true,
      hasDocs: true,
    }),
    false,
  );
  assert.equal(
    shouldShowAnalysisOutline({
      hasTranscript: true,
      hasAmount: true,
    }),
    true,
  );

  // Thin eligibility remains closed
  assert.deepEqual(
    resolutionEligibility({
      hasDocs: false,
      hasTranscript: false,
      hasAmount: false,
      hasTaxYear: false,
    }),
    { installment: false, penaltyRelief: false },
  );

  const root = process.cwd();
  const orch = readFileSync(join(root, "src/lib/ai/orchestrator.ts"), "utf8");
  assert.match(orch, /IRS_ACCOUNT_TRANSCRIPT|documentType/);
  assert.match(orch, /Array\.isArray\(\(facts as Json\)\.tax_years\)/);
  assert.match(readFileSync(join(root, "src/lib/evidence/compile.ts"), "utf8"), /docKindFromDocumentType/);
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-F-TRANSCRIPT-DEEPEN.md"), "utf8"),
    /Package F/i,
  );

  console.log("phase-package-f-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
