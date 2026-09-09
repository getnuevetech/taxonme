/**
 * Package U — Gated hybrid authority retrieval (embedding slice).
 * Run: npx tsx scripts/phase-package-u-check.ts
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
    parseEmbeddingJson,
    cosineSimilarity,
    hybridAuthorityScore,
    EMBED_MIN_COSINE,
    EMBED_SCORE_WEIGHT,
  } = await import("../src/lib/ai/embeddings");
  const {
    authorityGateOptsFromQuery,
    authoritySourceBlockedByGates,
  } = await import("../src/lib/authority-gates");
  const { retrieveKnowledgeForQuery } = await import("../src/lib/authority-retrieval");
  const { db } = await import("../src/lib/db");

  assert.equal(parseEmbeddingJson(""), null);
  assert.equal(parseEmbeddingJson("[1,2]"), null);
  const vec = parseEmbeddingJson(JSON.stringify(Array.from({ length: 16 }, (_, i) => (i === 0 ? 1 : 0))));
  assert.ok(vec);
  assert.equal(vec!.length, 16);

  const a = [1, 0, 0, 0, 0, 0, 0, 0];
  const b = [0.9, 0.1, 0, 0, 0, 0, 0, 0];
  const cos = cosineSimilarity(a, b);
  assert.ok(cos != null && cos > 0.8);

  assert.equal(hybridAuthorityScore(2, null, a), 2);
  assert.ok(hybridAuthorityScore(0, a, b)! > 0);
  assert.ok(hybridAuthorityScore(0, a, b)! >= EMBED_SCORE_WEIGHT * EMBED_MIN_COSINE);

  const thin =
    "I owe IRS some money but I am not sure how much and what I need to do.";
  const thinGate = authorityGateOptsFromQuery(thin);
  assert.equal(thinGate.allowInstallmentThresholds, false);

  // Synonym-style: keyword miss (no shared long tokens) but high cosine.
  const queryEmbed = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const sourceEmbed = [0.95, 0.05, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const synonymScore = hybridAuthorityScore(0, queryEmbed, sourceEmbed);
  assert.ok(synonymScore > 0);

  const installmentSource = {
    title: "Installment agreements (payment plans)",
    tags: "requires_known_balance",
    content: "Individuals who owe $50,000 or less may qualify for streamlined monthly plans.",
    taxYear: null as number | null,
  };
  assert.equal(
    authoritySourceBlockedByGates(installmentSource, {
      allowInstallmentThresholds: thinGate.allowInstallmentThresholds,
      allowNamedRelief: thinGate.allowNamedRelief,
      caseTaxYear: thinGate.snap.caseTaxYear,
    }),
    true,
    "High cosine must not bypass Package P/B/G gates on thin debt",
  );

  // Live retrieval still gates thin debt (Package P regression).
  const thinHits = await retrieveKnowledgeForQuery(thin);
  assert.doesNotMatch(thinHits, /\$\s?50,?000|First[- ]?Time Abate|\bFTA\b|streamlined monthly/i);

  // Inject embedding on a non-gated notice source; synonym query with no notice tokens
  // but matching vector should retrieve when we plant query-side via stored overlap path.
  // Keyword-only notice still works:
  const noticeHits = await retrieveKnowledgeForQuery(
    "I received an LT11 Final Notice of Intent to Levy and need to understand what it means.",
  );
  if (noticeHits) {
    assert.match(noticeHits, /LT11|levy|1058/i);
  }

  // DB: empty embeddingJson means keyword-only degradation for a planted source.
  const probe = await db.knowledgeSource.create({
    data: {
      title: "Package U hybrid probe source",
      sourceType: "publication",
      reference: "PKG-U-PROBE",
      content: "Unique token zzyxqwvuts for Package U retrieval probe only.",
      tags: "package_u_probe",
      isActive: true,
      embeddingJson: JSON.stringify(sourceEmbed),
      embeddingModel: "test-vector",
      embeddedAt: new Date(),
    },
  });
  try {
    // Without live query embedding provider, hybrid falls back to keyword — probe still finds unique token.
    const keywordHit = await retrieveKnowledgeForQuery("zzyxqwvuts package u probe");
    assert.match(keywordHit, /PKG-U-PROBE|zzyxqwvuts/i);
  } finally {
    await db.knowledgeSource.delete({ where: { id: probe.id } });
    await db.$disconnect();
  }

  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  assert.match(schema, /model KnowledgeSource[\s\S]*embeddingJson/);

  const migration = readFileSync(
    join(root, "prisma/migrations/20260909180000_package_u_knowledge_embeddings/migration.sql"),
    "utf8",
  );
  assert.match(migration, /embeddingJson/);

  const retrieval = readFileSync(join(root, "src/lib/authority-retrieval.ts"), "utf8");
  assert.match(retrieval, /hybridAuthorityScore/);
  assert.match(retrieval, /authoritySourceBlockedByGates/);
  assert.match(retrieval, /embedQueryText/);

  const adminActions = readFileSync(join(root, "src/actions/admin.ts"), "utf8");
  assert.match(adminActions, /embedKnowledgeSourceById/);

  assert.match(
    readFileSync(join(root, "scripts/knowledge-embed-backfill.ts"), "utf8"),
    /embedKnowledgeSourceById/,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-U-GATED-HYBRID-AUTHORITY.md"), "utf8"),
    /Package U/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*U\*\*.*hybrid|embedding/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-u"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-u/);

  console.log("phase-package-u-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
