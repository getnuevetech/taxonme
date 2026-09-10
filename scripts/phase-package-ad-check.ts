/**
 * Package AD — Amount-known path honesty.
 * Run: npx tsx scripts/phase-package-ad-check.ts
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
  const { fallbackAnalyze } = await import("../src/lib/ai/fallback");

  // Amount known, no transcript, no installment ask → no 9465 / no "confirm resolution" / no streamlined wording.
  const amountOnly = await fallbackAnalyze(
    "I owe the IRS about $8000 for 2022 and I am not sure what to do.",
    "Figure out next steps",
    "",
    [],
  );
  assert.equal(
    amountOnly.pathSteps.some((s) => /9465|payment plan/i.test(s.title)),
    false,
    "bare amount must not open Form 9465 path",
  );
  assert.equal(
    amountOnly.pathSteps.some((s) => /Confirm the resolution/i.test(s.title)),
    false,
    "bare amount must not open confirm-resolution",
  );
  const amountOutline = (
    amountOnly.issues.find((i) => i.issue_type === "balance_due") as {
      analysis_outline?: { heading: string; detail: string }[];
    }
  )?.analysis_outline;
  const taxRules = amountOutline?.find((x) => x.heading === "Tax rules")?.detail ?? "";
  assert.doesNotMatch(taxRules, /streamlined thresholds/i);
  assert.match(taxRules, /composition|amount-based eligibility/i);

  // Explicit installment ask without transcript → 9465 prep allowed.
  const withAsk = await fallbackAnalyze(
    "I owe about $8000 for 2022 and want a payment plan.",
    "Set up installment",
    "",
    [],
  );
  assert.equal(
    withAsk.pathSteps.some((s) => /9465|payment plan/i.test(s.title)),
    true,
    "user installment ask may open Form 9465 prep",
  );

  // Transcript establishes amount → 9465 path still opens (Package F lock).
  const deep = await fallbackAnalyze(
    "I owe IRS some money but I am not sure how much and what I need to do.",
    "I need to know what I owe and what to do.",
    TRANSCRIPT,
    [{ docKind: "other", readable: true, documentType: "", fileName: "account-transcript.pdf" }],
  );
  assert.equal(
    deep.pathSteps.some((s) => /9465|payment plan/i.test(s.title)),
    true,
    "transcript-confirmed amount still opens installment path",
  );
  assert.doesNotMatch(JSON.stringify(deep.issues), /streamlined thresholds/i);

  const view = readFileSync(join(root, "src/components/case-analysis-view.tsx"), "utf8");
  assert.match(view, /Prepare Form 9465 request/);
  assert.doesNotMatch(view, /Open the payment plan form|Start the payment plan form/);

  const fallbackSrc = readFileSync(join(root, "src/lib/ai/fallback.ts"), "utf8");
  assert.match(fallbackSrc, /Package AD/);
  assert.doesNotMatch(fallbackSrc, /common streamlined thresholds/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AD-AMOUNT-KNOWN-PATH-HONESTY.md"), "utf8"),
    /Package AD/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AD\*\*.*Amount-known|9465|streamlined/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ad"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ad/);

  console.log("phase-package-ad-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
