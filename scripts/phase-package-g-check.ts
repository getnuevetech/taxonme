/**
 * Package G — knowledge freshness (FTA/AEP taxYear + re-seed upsert).
 * Run: npx tsx scripts/phase-package-g-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const {
    PERIOD_SENSITIVE_KNOWLEDGE,
    aepSeed,
    expectedAepTaxYear,
    expectedFtaTaxYear,
    ftaSeed,
    installmentSeed,
    knowledgeSourceNeedsRefresh,
    knowledgeSourceWriteData,
  } = await import("../src/lib/knowledge-authority-seed");
  const { authoritySourceBlockedByGates, reliefProgramLabel } = await import(
    "../src/lib/authority-gates"
  );

  assert.equal(expectedFtaTaxYear(), 2024);
  assert.equal(expectedAepTaxYear(), 2025);
  assert.equal(ftaSeed().taxYear, 2024);
  assert.equal(aepSeed().taxYear, 2025);
  assert.equal(installmentSeed().taxYear ?? null, null);
  assert.match(installmentSeed().tags, /requires_known_balance/);
  assert.match(installmentSeed().content, /\$50,000/);
  assert.match(ftaSeed().tags, /applies_through_2024/);
  assert.match(aepSeed().tags, /ty2025|aep/i);
  assert.equal(PERIOD_SENSITIVE_KNOWLEDGE.length, 3);

  // Stale row (pre–Package B seed) must be detected as needing refresh.
  const staleFta = {
    sourceType: "rule",
    reference: "FTA",
    tags: "penalty, fta",
    content: "First-time abatement",
    taxYear: null as number | null,
  };
  assert.equal(knowledgeSourceNeedsRefresh(staleFta, ftaSeed()), true);
  assert.equal(knowledgeSourceNeedsRefresh(knowledgeSourceWriteData(ftaSeed()), ftaSeed()), false);

  // Year mismatch still blocked when case year known.
  assert.equal(
    authoritySourceBlockedByGates(
      {
        title: ftaSeed().title,
        tags: ftaSeed().tags,
        content: ftaSeed().content,
        taxYear: 2024,
      },
      { allowInstallmentThresholds: true, allowNamedRelief: true, caseTaxYear: 2025 },
    ),
    true,
  );
  assert.equal(
    authoritySourceBlockedByGates(
      {
        title: aepSeed().title,
        tags: aepSeed().tags,
        content: aepSeed().content,
        taxYear: 2025,
      },
      { allowInstallmentThresholds: true, allowNamedRelief: true, caseTaxYear: 2025 },
    ),
    false,
  );
  assert.equal(reliefProgramLabel(2024), "FTA");
  assert.equal(reliefProgramLabel(2025), "AEP");

  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  assert.match(seed, /knowledge-authority-seed/);
  assert.match(seed, /knowledgeSourceWriteData/);
  assert.match(seed, /Package G: create-or-update/);
  const seedFn = seed.slice(seed.indexOf("async function seedKnowledge"), seed.indexOf("async function seedFormTemplates"));
  assert.match(seedFn, /db\.knowledgeSource\.update/);
  assert.ok(seedFn.includes("await db.knowledgeSource.update"));
  assert.ok(seedFn.includes("else {"));
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-G-KNOWLEDGE-FRESHNESS.md"), "utf8"),
    /Package G/i,
  );
  assert.match(readFileSync(join(root, "DEPLOYMENT.md"), "utf8"), /FTA|taxYear|create-or-update/i);

  console.log("phase-package-g-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
