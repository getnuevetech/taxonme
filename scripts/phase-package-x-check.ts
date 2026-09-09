/**
 * Package X — Force overwrite ConversationIntelligence re-enrich.
 * Run: npx tsx scripts/phase-package-x-check.ts
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

const PLAYBOOK_SNAPSHOT = JSON.stringify({
  question_contract: {
    explicit_question: THIN_FIXTURE,
    decision_target: "resolution_path",
  },
  intent: { recommended_response_mode: "answer" },
  answerability: { can_answer_now: true },
  need_to_know: [],
  strategy: {
    mode: "answer",
    branch_before_clarify: false,
    branches: [
      {
        id: "installment_agreement",
        condition: "If you want a payment plan",
        explanation: "File Form 9465 for an installment agreement under $50,000.",
      },
      {
        id: "currently_not_collectible",
        condition: "If you cannot pay",
        explanation: "Request Currently Not Collectible status.",
      },
      {
        id: "offer_in_compromise",
        condition: "If you want to settle",
        explanation: "Consider Offer in Compromise.",
      },
    ],
    ask_now: [],
  },
  route: {
    response_mode: "answer",
    workspace: "situation",
    pipeline: "assistant",
    invokes_case_engine: false,
  },
  learning_event: {},
  experience_record: {},
});

async function main() {
  const root = process.cwd();
  const {
    isForceReenrichEligible,
    forceReenrichIntelligence,
    formatForceReenrichSummary,
  } = await import("../src/lib/admin/intelligence-force-reenrich");
  const {
    needsIntelligenceBackfill,
    backfillEmptyCaseIntelligence,
  } = await import("../src/lib/admin/intelligence-backfill");
  const { parseStoredIntelligence, runConversationIntelligence } = await import(
    "../src/lib/conversation"
  );
  const { db } = await import("../src/lib/db");

  assert.equal(isForceReenrichEligible("{}"), false);
  assert.equal(isForceReenrichEligible(PLAYBOOK_SNAPSHOT), true);
  assert.equal(needsIntelligenceBackfill(PLAYBOOK_SNAPSHOT), false);

  const fresh = runConversationIntelligence({
    message: THIN_FIXTURE,
    goal: "What should I do?",
  });
  assert.doesNotMatch(JSON.stringify(fresh.strategy?.branches ?? []), /installment_agreement|currently_not_collectible|offer_in_compromise/);

  const row = await db.case.create({
    data: {
      title: "Package X force reenrich probe",
      situation: THIN_FIXTURE,
      goal: "What should I do?",
      intelligenceJson: PLAYBOOK_SNAPSHOT,
      status: "intake",
    },
  });

  try {
    // Empty-only must skip parseable playbook snapshot.
    const emptySkip = await backfillEmptyCaseIntelligence({
      dryRun: false,
      caseId: row.id,
    });
    assert.equal(emptySkip.skipped, 1);
    assert.equal(emptySkip.written, 0);

    const blocked = await forceReenrichIntelligence("case", {
      dryRun: false,
      force: false,
      entityId: row.id,
    });
    assert.equal(blocked.failed, 1);
    assert.match(blocked.failures[0]?.error ?? "", /force=true/i);

    const dry = await forceReenrichIntelligence("case", {
      dryRun: true,
      entityId: row.id,
    });
    assert.equal(dry.eligible, 1);
    assert.equal(dry.written, 0);
    assert.match(formatForceReenrichSummary(dry), /force-reenrich.*dry-run/);

    const applied = await forceReenrichIntelligence("case", {
      dryRun: false,
      force: true,
      entityId: row.id,
    });
    assert.equal(applied.written, 1);
    assert.equal(applied.failed, 0);

    const after = await db.case.findUnique({
      where: { id: row.id },
      select: { intelligenceJson: true },
    });
    const parsed = parseStoredIntelligence(after?.intelligenceJson);
    assert.ok(parsed);
    const blob = after?.intelligenceJson ?? "";
    assert.doesNotMatch(blob, /installment_agreement|Form 9465|Offer in Compromise|Currently Not Collectible/i);
    assert.match(blob, /establish_account_position|Account Transcript|notice/i);

    const forceSrc = readFileSync(
      join(root, "src/lib/admin/intelligence-force-reenrich.ts"),
      "utf8",
    );
    assert.match(forceSrc, /reenrichEntityIntelligence/);
    assert.match(forceSrc, /force/);

    const adminActions = readFileSync(join(root, "src/actions/admin.ts"), "utf8");
    assert.match(adminActions, /forceReenrichIntelligenceAction/);
    assert.match(adminActions, /confirmOverwrite/);
    assert.match(adminActions, /requireAdminArea\("admin\.ai"\)/);

    const page = readFileSync(join(root, "src/app/admin/intelligence/page.tsx"), "utf8");
    assert.match(page, /IntelligenceForceReenrichPanel/);

    assert.match(
      readFileSync(join(root, "scripts/intelligence-force-reenrich.ts"), "utf8"),
      /forceReenrichIntelligence/,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-X-FORCE-INTEL-REENRICH.md"), "utf8"),
      /Package X/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*X\*\*.*force|overwrite|re-enrich/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-x"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-x/);

    // T/W empty path still never overwrites without Package X.
    const backfillSrc = readFileSync(
      join(root, "src/lib/admin/intelligence-backfill.ts"),
      "utf8",
    );
    assert.doesNotMatch(backfillSrc, /forceReenrichIntelligence/);
  } finally {
    await db.case.deleteMany({ where: { id: row.id } });
    await db.$disconnect();
  }

  console.log("phase-package-x-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
