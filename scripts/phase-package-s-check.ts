/**
 * Package S — Experience L3/L4 Production corpus.
 * Run: npx tsx scripts/phase-package-s-check.ts
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
    curatedProductionPatterns,
    seedCuratedProductionPatterns,
    PACKAGE_S_TAX_RELIEF_DIGEST,
    PACKAGE_S_NOTICE_DIGEST,
    PACKAGE_S_THIN_DEBT_DIGEST,
    assertSafeForSharedExperience,
    canPromoteToProduction,
    assertAllProductionLevel,
    rankProductionPatterns,
    productionPatternAskHints,
    applyExperienceAskHints,
    runConversationIntelligence,
    enrichIntelligenceWithReasoningModel,
    TAX_RELIEF_SCHEMA_NEGATIVE_LESSON,
  } = await import("../src/lib/experience").then(async (exp) => {
    const conv = await import("../src/lib/conversation");
    return { ...exp, ...conv };
  });

  const patterns = curatedProductionPatterns();
  assert.ok(patterns.length >= 3);
  assertAllProductionLevel(patterns);
  for (const pattern of patterns) {
    assertSafeForSharedExperience(pattern);
    assert.equal(pattern.promotion_level, 4);
    assert.equal(canPromoteToProduction(pattern).ok, true);
    assert.ok(!pattern.facts_discarded.includes(""));
  }

  const digests = new Set(patterns.map((p) => p.source_digest));
  assert.ok(digests.has(PACKAGE_S_TAX_RELIEF_DIGEST));
  assert.ok(digests.has(PACKAGE_S_NOTICE_DIGEST));
  assert.ok(digests.has(PACKAGE_S_THIN_DEBT_DIGEST));

  const taxRelief = patterns.find((p) => p.source_digest === PACKAGE_S_TAX_RELIEF_DIGEST)!;
  assert.equal(taxRelief.clarification_key, "ability_to_pay");
  assert.ok(taxRelief.facts_discarded.includes("full_form_433_package"));
  assert.ok(taxRelief.negative_lesson_ids.includes(TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id));

  const hits = rankProductionPatterns(patterns, {
    decisionTarget: "identify_available_pathways",
    workspace: "existing_case",
    factKeys: ["ability_to_pay", "balance_due", "collection_notice"],
    pathways: ["installment_agreement"],
    negativeLessonIds: [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id],
  });
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].pattern.source_digest, PACKAGE_S_TAX_RELIEF_DIGEST);

  const hints = productionPatternAskHints(hits);
  assert.ok(hints.prefer_keys.includes("ability_to_pay"));
  assert.ok(hints.suppress_keys.includes("full_form_433_package"));

  const narrative =
    "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";
  const base = runConversationIntelligence({
    message: narrative,
    goal: "What are my options?",
  });
  const withCompetingAsk = {
    ...base,
    strategy: {
      ...base.strategy,
      mode: "answer_then_targeted_question" as const,
      ask_now: [
        {
          question: "Please complete the full Form 433 package with all income, expenses, and assets.",
          tier: "critical_now" as const,
          reason: "schema",
          changes_branch: true,
          branches_affected: ["offer_in_compromise"],
        },
        {
          question:
            "Can you make any monthly payment toward the balance, or is paying anything right now impossible?",
          tier: "critical_now" as const,
          reason: "ability",
          changes_branch: true,
          branches_affected: ["installment_agreement"],
        },
      ],
    },
  };
  const reordered = applyExperienceAskHints(withCompetingAsk, hints);
  assert.match(reordered.strategy.ask_now[0]?.question ?? "", /monthly payment/i);
  assert.doesNotMatch(reordered.strategy.ask_now[0]?.question ?? "", /Form 433/i);

  // Injected hints through enrich path — still no invented asks.
  const enriched = await enrichIntelligenceWithReasoningModel(
    withCompetingAsk,
    { message: narrative, goal: "What are my options?" },
    { experienceHints: hints, attemptModelRefine: false },
  );
  assert.match(enriched.strategy.ask_now[0]?.question ?? "", /monthly payment/i);
  assert.equal(
    enriched.strategy.ask_now.some((q) => /Form 433/i.test(q.question)),
    false,
  );

  // Live DB upsert + search (local/CI with Postgres).
  const seeded = await seedCuratedProductionPatterns();
  assert.equal(seeded.upserted, patterns.length);
  const { searchProductionExperience } = await import("../src/lib/experience");
  const liveHits = await searchProductionExperience({
    decisionTarget: "identify_available_pathways",
    workspace: "existing_case",
    factKeys: ["ability_to_pay", "balance_due", "collection_notice"],
    pathways: ["installment_agreement"],
    negativeLessonIds: [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id],
    limit: 5,
  });
  assert.ok(liveHits.some((h) => h.pattern.source_digest === PACKAGE_S_TAX_RELIEF_DIGEST));

  assert.match(
    readFileSync(join(root, "prisma/seed.ts"), "utf8"),
    /seedExperiencePatterns|seedCuratedProductionPatterns/,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-S-EXPERIENCE-CORPUS.md"), "utf8"),
    /Package S/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*S\*\*.*Experience|Production corpus/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-s"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-s/);

  console.log("phase-package-s-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
