/**
 * Package T — Historical Case intelligence backfill.
 * Run: npx tsx scripts/phase-package-t-check.ts
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
    needsIntelligenceBackfill,
    backfillEmptyCaseIntelligence,
    formatBackfillSummary,
  } = await import("../src/lib/admin/intelligence-backfill");
  const { parseStoredIntelligence, runConversationIntelligence } = await import(
    "../src/lib/conversation"
  );
  const { db } = await import("../src/lib/db");

  assert.equal(needsIntelligenceBackfill("{}"), true);
  assert.equal(needsIntelligenceBackfill(null), true);
  assert.equal(needsIntelligenceBackfill("{"), true);
  const sample = JSON.stringify(
    runConversationIntelligence({
      message: "I received a CP504 and need options.",
      goal: "options",
    }),
  );
  assert.ok(parseStoredIntelligence(sample));
  assert.equal(needsIntelligenceBackfill(sample), false);

  // Seed an empty Case for apply, then a filled Case that must be skipped.
  const emptyCase = await db.case.create({
    data: {
      title: "Package T empty intel probe",
      situation: "I owe IRS money and am not sure how much or what to do.",
      goal: "What should I do next?",
      intelligenceJson: "{}",
      status: "intake",
    },
  });
  const filledCase = await db.case.create({
    data: {
      title: "Package T filled intel probe",
      situation: "CP504 levy notice for tax year 2022.",
      goal: "Explain notice",
      intelligenceJson: sample,
      status: "intake",
    },
  });

  try {
    const dry = await backfillEmptyCaseIntelligence({
      dryRun: true,
      caseId: emptyCase.id,
    });
    assert.equal(dry.dryRun, true);
    assert.equal(dry.eligible, 1);
    assert.equal(dry.written, 0);
    assert.match(formatBackfillSummary(dry), /dry-run/);

    const skipDry = await backfillEmptyCaseIntelligence({
      dryRun: true,
      caseId: filledCase.id,
    });
    assert.equal(skipDry.eligible, 0);
    assert.equal(skipDry.skipped, 1);

    const applied = await backfillEmptyCaseIntelligence({
      dryRun: false,
      caseId: emptyCase.id,
    });
    assert.equal(applied.written, 1);
    assert.equal(applied.failed, 0);
    const after = await db.case.findUnique({
      where: { id: emptyCase.id },
      select: { intelligenceJson: true },
    });
    assert.ok(parseStoredIntelligence(after?.intelligenceJson));
    assert.ok((after?.intelligenceJson.length ?? 0) > 10);

    // Second apply must skip the now-filled Case.
    const again = await backfillEmptyCaseIntelligence({
      dryRun: false,
      caseId: emptyCase.id,
    });
    assert.equal(again.skipped, 1);
    assert.equal(again.written, 0);

    const backfillSrc = readFileSync(
      join(root, "src/lib/admin/intelligence-backfill.ts"),
      "utf8",
    );
    assert.match(backfillSrc, /reenrichEntityIntelligence/);
    assert.match(backfillSrc, /needsIntelligenceBackfill/);
    assert.match(backfillSrc, /dryRun/);

    const adminActions = readFileSync(join(root, "src/actions/admin.ts"), "utf8");
    assert.match(adminActions, /backfillCaseIntelligenceAction/);
    assert.match(adminActions, /requireAdminArea\("admin\.ai"\)/);

    const page = readFileSync(join(root, "src/app/admin/intelligence/page.tsx"), "utf8");
    assert.match(page, /IntelligenceBackfillPanel/);

    assert.match(
      readFileSync(join(root, "scripts/case-intelligence-backfill.ts"), "utf8"),
      /backfillEmptyCaseIntelligence/,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-T-CASE-INTELLIGENCE-BACKFILL.md"), "utf8"),
      /Package T/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*T\*\*.*backfill|Case.*intelligence backfill/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-t"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-t/);
  } finally {
    await db.case.deleteMany({
      where: { id: { in: [emptyCase.id, filledCase.id] } },
    });
    await db.$disconnect();
  }

  console.log("phase-package-t-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
