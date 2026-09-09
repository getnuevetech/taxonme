/**
 * Package W — Situation / QaThread empty-intelligence backfill.
 * Run: npx tsx scripts/phase-package-w-check.ts
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

const THIN_FIXTURE =
  "I owe IRS some money but I am not sure how much and what I need to do.";

async function main() {
  const root = process.cwd();
  const {
    needsIntelligenceBackfill,
    backfillEmptySituationIntelligence,
    backfillEmptyQaThreadIntelligence,
    formatBackfillSummary,
  } = await import("../src/lib/admin/intelligence-backfill");
  const { parseStoredIntelligence, runConversationIntelligence } = await import(
    "../src/lib/conversation"
  );
  const { db } = await import("../src/lib/db");

  assert.equal(needsIntelligenceBackfill("{}"), true);
  const sample = JSON.stringify(
    runConversationIntelligence({
      message: "I received a CP504 and need options.",
      goal: "options",
    }),
  );
  assert.ok(parseStoredIntelligence(sample));
  assert.equal(needsIntelligenceBackfill(sample), false);

  const emptySit = await db.situation.create({
    data: {
      title: "Package W empty situation",
      originalNarrative: THIN_FIXTURE,
      goal: "What should I do next?",
      intelligenceJson: "{}",
      status: "open",
    },
  });
  const filledSit = await db.situation.create({
    data: {
      title: "Package W filled situation",
      originalNarrative: "CP504 levy notice for tax year 2022.",
      goal: "Explain notice",
      intelligenceJson: sample,
      status: "open",
    },
  });
  const emptyThread = await db.qaThread.create({
    data: {
      title: "Package W empty qa",
      kind: "qa",
      intelligenceJson: "{}",
    },
  });
  await db.qaMessage.create({
    data: { threadId: emptyThread.id, role: "user", content: THIN_FIXTURE },
  });
  await db.qaMessage.create({
    data: {
      threadId: emptyThread.id,
      role: "assistant",
      content: "Let's identify what the IRS shows via an Account Transcript.",
    },
  });
  const filledThread = await db.qaThread.create({
    data: {
      title: "Package W filled qa",
      kind: "qa",
      intelligenceJson: sample,
    },
  });

  try {
    const sitDry = await backfillEmptySituationIntelligence({
      dryRun: true,
      entityId: emptySit.id,
    });
    assert.equal(sitDry.kind, "situation");
    assert.equal(sitDry.eligible, 1);
    assert.equal(sitDry.written, 0);
    assert.match(formatBackfillSummary(sitDry), /Situation.*dry-run/);

    const sitSkip = await backfillEmptySituationIntelligence({
      dryRun: true,
      entityId: filledSit.id,
    });
    assert.equal(sitSkip.skipped, 1);
    assert.equal(sitSkip.eligible, 0);

    const sitApply = await backfillEmptySituationIntelligence({
      dryRun: false,
      entityId: emptySit.id,
    });
    assert.equal(sitApply.written, 1);
    assert.equal(sitApply.failed, 0);
    const sitAfter = await db.situation.findUnique({
      where: { id: emptySit.id },
      select: { intelligenceJson: true },
    });
    assert.ok(parseStoredIntelligence(sitAfter?.intelligenceJson));

    const sitAgain = await backfillEmptySituationIntelligence({
      dryRun: false,
      entityId: emptySit.id,
    });
    assert.equal(sitAgain.skipped, 1);
    assert.equal(sitAgain.written, 0);

    const qaDry = await backfillEmptyQaThreadIntelligence({
      dryRun: true,
      entityId: emptyThread.id,
    });
    assert.equal(qaDry.kind, "qa_thread");
    assert.equal(qaDry.eligible, 1);

    const qaSkip = await backfillEmptyQaThreadIntelligence({
      dryRun: true,
      entityId: filledThread.id,
    });
    assert.equal(qaSkip.skipped, 1);

    const qaApply = await backfillEmptyQaThreadIntelligence({
      dryRun: false,
      entityId: emptyThread.id,
    });
    assert.equal(qaApply.written, 1);
    assert.equal(qaApply.failed, 0);
    const qaAfter = await db.qaThread.findUnique({
      where: { id: emptyThread.id },
      select: { intelligenceJson: true },
    });
    assert.ok(parseStoredIntelligence(qaAfter?.intelligenceJson));

    const backfillSrc = readFileSync(
      join(root, "src/lib/admin/intelligence-backfill.ts"),
      "utf8",
    );
    assert.match(backfillSrc, /backfillEmptySituationIntelligence/);
    assert.match(backfillSrc, /backfillEmptyQaThreadIntelligence/);
    assert.match(backfillSrc, /reenrichEntityIntelligence/);

    const caseActions = readFileSync(join(root, "src/actions/case.ts"), "utf8");
    assert.match(caseActions, /Package W/);
    assert.match(caseActions, /intelligenceJson: JSON\.stringify\(intel\)/);

    const adminActions = readFileSync(join(root, "src/actions/admin.ts"), "utf8");
    assert.match(adminActions, /backfillSituationQaIntelligenceAction/);
    assert.match(adminActions, /requireAdminArea\("admin\.ai"\)/);

    const page = readFileSync(join(root, "src/app/admin/intelligence/page.tsx"), "utf8");
    assert.match(page, /SituationQaIntelligenceBackfillPanel/);

    assert.match(
      readFileSync(join(root, "scripts/situation-qa-intelligence-backfill.ts"), "utf8"),
      /backfillEmptyIntelligence/,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-W-SITUATION-QA-INTEL-BACKFILL.md"), "utf8"),
      /Package W/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*W\*\*.*Situation|QaThread|backfill/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-w"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-w/);
  } finally {
    await db.qaMessage.deleteMany({
      where: { threadId: { in: [emptyThread.id, filledThread.id] } },
    });
    await db.qaThread.deleteMany({
      where: { id: { in: [emptyThread.id, filledThread.id] } },
    });
    await db.situation.deleteMany({
      where: { id: { in: [emptySit.id, filledSit.id] } },
    });
    await db.$disconnect();
  }

  console.log("phase-package-w-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
