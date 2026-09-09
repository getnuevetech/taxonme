/**
 * Package P — Gated knowledge retrieval for Q&A / notice keyword path.
 * Run: npx tsx scripts/phase-package-p-check.ts
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
    snapshotFromQueryText,
    authorityGateOptsFromQuery,
    authoritySourceBlockedByGates,
  } = await import("../src/lib/authority-gates");

  const thin =
    "I owe IRS some money but I am not sure how much and what I need to do.";
  const thinGate = authorityGateOptsFromQuery(thin);
  assert.equal(thinGate.allowInstallmentThresholds, false);
  assert.equal(thinGate.allowNamedRelief, false);
  assert.equal(thinGate.snap.hasAmount, false);

  const installmentAsk = "How does an IRS installment agreement work under $50,000?";
  const instGate = authorityGateOptsFromQuery(installmentAsk);
  assert.equal(instGate.allowInstallmentThresholds, true);

  const ftaAsk = "What is First-Time Abatement for tax penalties?";
  const ftaGate = authorityGateOptsFromQuery(ftaAsk);
  assert.equal(ftaGate.allowNamedRelief, true);

  const yearAmount = "I owe $12,400 for tax year 2023 — what are my options?";
  const ya = snapshotFromQueryText(yearAmount);
  assert.equal(ya.hasAmount, true);
  assert.equal(ya.caseTaxYear, 2023);
  const yaGate = authorityGateOptsFromQuery(yearAmount);
  assert.equal(yaGate.allowInstallmentThresholds, true);
  assert.equal(yaGate.allowNamedRelief, true);

  const installmentSource = {
    title: "Installment agreements (payment plans)",
    tags: "requires_known_balance",
    content: "Individuals who owe $50,000 or less may qualify for streamlined monthly plans.",
    taxYear: null as number | null,
  };
  const ftaSource = {
    title: "First Time Abate (FTA) administrative waiver",
    tags: "penalty relief FTA",
    content: "FTA may remove failure-to-file or failure-to-pay penalties for eligible taxpayers.",
    taxYear: 2024,
  };
  const lt11Source = {
    title: "LT11 Final Notice of Intent to Levy",
    tags: "LT11 levy notice",
    content: "LT11 warns of levy action and states a respond-by window.",
    taxYear: null as number | null,
  };

  assert.equal(
    authoritySourceBlockedByGates(installmentSource, {
      allowInstallmentThresholds: thinGate.allowInstallmentThresholds,
      allowNamedRelief: thinGate.allowNamedRelief,
      caseTaxYear: thinGate.snap.caseTaxYear,
    }),
    true,
  );
  assert.equal(
    authoritySourceBlockedByGates(ftaSource, {
      allowInstallmentThresholds: thinGate.allowInstallmentThresholds,
      allowNamedRelief: thinGate.allowNamedRelief,
      caseTaxYear: thinGate.snap.caseTaxYear,
    }),
    true,
  );
  assert.equal(
    authoritySourceBlockedByGates(lt11Source, {
      allowInstallmentThresholds: thinGate.allowInstallmentThresholds,
      allowNamedRelief: thinGate.allowNamedRelief,
      caseTaxYear: thinGate.snap.caseTaxYear,
    }),
    false,
  );
  assert.equal(
    authoritySourceBlockedByGates(installmentSource, {
      allowInstallmentThresholds: instGate.allowInstallmentThresholds,
      allowNamedRelief: instGate.allowNamedRelief,
      caseTaxYear: instGate.snap.caseTaxYear,
    }),
    false,
  );

  // Live retrieval against seeded KB when present.
  const { retrieveKnowledgeForQuery } = await import("../src/lib/authority-retrieval");
  const thinHits = await retrieveKnowledgeForQuery(
    "I owe the IRS some money but I am not sure how much and what I need to do about the debt.",
  );
  assert.doesNotMatch(thinHits, /\$\s?50,?000|First[- ]?Time Abate|\bFTA\b|streamlined monthly/i);

  const eduHits = await retrieveKnowledgeForQuery(
    "Please explain how an IRS installment agreement / payment plan works, including the $50,000 streamlined threshold.",
  );
  // Education ask should be allowed to surface installment threshold material when seeded.
  if (eduHits) {
    assert.match(eduHits, /installment|payment plan|9465|streamlined|50,?000/i);
  }

  const noticeHits = await retrieveKnowledgeForQuery(
    "I received an LT11 Final Notice of Intent to Levy and need to understand what it means.",
  );
  if (noticeHits) {
    assert.match(noticeHits, /LT11|levy|1058/i);
    assert.doesNotMatch(noticeHits, /\$\s?50,?000|First[- ]?Time Abate|\bFTA\b|streamlined monthly/i);
  }

  const orch = readFileSync(join(root, "src/lib/ai/orchestrator.ts"), "utf8");
  assert.match(orch, /retrieveKnowledgeForQuery/);
  assert.match(orch, /Package P/);
  assert.match(orch, /authorityGateOptsFromQuery/);

  const retrieval = readFileSync(join(root, "src/lib/authority-retrieval.ts"), "utf8");
  assert.match(retrieval, /export async function retrieveKnowledgeForQuery/);
  assert.match(retrieval, /authoritySourceBlockedByGates/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-P-GATED-KNOWLEDGE-RETRIEVAL.md"), "utf8"),
    /Package P/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*P\*\*.*Gated knowledge|gated knowledge retrieval/i,
  );

  console.log("phase-package-p-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
