/**
 * Package AF — Identify-only mid-collection KB (CP501 + ladder).
 * Run: npx tsx scripts/phase-package-af-check.ts
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

const PLAYBOOK_RE =
  /installment\s+agreement|form\s*9465|payment\s+plan|offer\s+in\s+compromise|\bOIC\b|currently[\s-]?not[\s-]?collectible|\bCNC\b|\$\s?50,?000|\$\s?100,?000/i;

const AF_TITLES = [
  "CP501 — Reminder of unpaid tax",
  "Collection notice ladder — identify the stage",
] as const;

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  for (const title of AF_TITLES) {
    assert.match(seed, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Package AF — mid-collection identify-only/);
  assert.match(seed, /CP14, CP501, CP503, CP504/);

  for (const title of AF_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = seed.match(new RegExp(`title: "${escaped}"[\\s\\S]*?content: "([^"]+)"`))?.[1] ?? "";
    assert.ok(block.length > 40, `missing content for ${title}`);
    assert.doesNotMatch(block, PLAYBOOK_RE);
    assert.match(block, /Account Transcript|identify|Confirm|Read the CP/i);
  }

  const identifyBlock =
    seed.match(/title: "Identifying an IRS notice"[\s\S]*?content: "([^"]+)"/)?.[1] ?? "";
  assert.match(identifyBlock, /CP501/);

  const { db } = await import("../src/lib/db");
  const { knowledgeSourceWriteData } = await import("../src/lib/knowledge-authority-seed");

  const rows = [
    {
      title: "CP501 — Reminder of unpaid tax",
      sourceType: "notice_guide",
      reference: "CP501",
      tags: "notice, balance due, reminder, collection, mid-collection",
      content:
        "A CP501 is typically an early reminder that a balance remains unpaid after a first balance-due notice such as a CP14. It usually restates tax, penalties, and interest and asks for a response. Confirm the printed amount, tax period, and any respond-by language on the notice. Compare those figures to an Account Transcript. Later reminders in the same series often include CP503 and CP504; LT11 / Letter 1058 is a separate final levy notice. This guide identifies the notice — it does not choose a payment or relief path.",
    },
    {
      title: "Collection notice ladder — identify the stage",
      sourceType: "rule",
      reference: "Collection notice ladder",
      tags: "notice, identify, collection, cp14, cp501, cp503, cp504, lt11, evidence",
      content:
        "Balance-due collection mail often follows a recognizable ladder: CP14 (first balance due) → CP501 (early reminder) → CP503 (further reminder) → CP504 (urgent / levy warning) → LT11 / Letter 1058 (final intent to levy with Collection Due Process hearing rights). Read the CP/LT code on your copy first, then the tax period, printed amount, and any respond-by date. An Account Transcript confirms assessments and activity for the same periods. Knowing which stage you are in is an identify step — do not treat the stage alone as selecting a specific resolution path.",
    },
    {
      title: "Identifying an IRS notice",
      sourceType: "rule",
      reference: "Notice identity",
      tags: "notice, identify, cp, lt, deadline, evidence",
      content:
        "Most IRS notices print a CP or LT code near the top, a tax period, amounts, and often a respond-by date. Read the code first (for example CP14, CP501, CP503, CP504, CP2000, CP3219A, LT11), then the period and printed figures. Keep the notice and calendar any deadline shown. An Account Transcript independently confirms assessments, payments, and recent activity for the same periods. Until the notice code, period, and IRS account position are established, do not treat any guide as selecting a specific resolution path.",
    },
  ];

  try {
    for (const row of rows) {
      const write = knowledgeSourceWriteData(row);
      const exists = await db.knowledgeSource.findFirst({ where: { title: row.title } });
      if (!exists) {
        await db.knowledgeSource.create({
          data: { title: row.title, ...write, isActive: true },
        });
      } else {
        await db.knowledgeSource.update({
          where: { id: exists.id },
          data: {
            ...write,
            isActive: true,
            ...(exists.content !== write.content
              ? { embeddingJson: "", embeddingModel: "", embeddedAt: null }
              : {}),
          },
        });
      }
    }

    const { authorityGateOptsFromQuery } = await import("../src/lib/authority-gates");
    const thinGate = authorityGateOptsFromQuery(THIN_FIXTURE);
    assert.equal(thinGate.allowResolutionPlaybooks, false);

    const { retrieveKnowledgeForQuery } = await import("../src/lib/authority-retrieval");
    const thinHits = await retrieveKnowledgeForQuery(THIN_FIXTURE);
    assert.doesNotMatch(thinHits, PLAYBOOK_RE);

    const cp501 = await retrieveKnowledgeForQuery(
      "I received a CP501 reminder of unpaid tax — what does it mean?",
    );
    assert.match(cp501, /CP501/i);
    assert.doesNotMatch(cp501, PLAYBOOK_RE);
    assert.match(cp501, /Account Transcript|identify/i);

    const ladder = await retrieveKnowledgeForQuery(
      "What is the IRS collection notice ladder from CP14 to LT11?",
    );
    assert.match(ladder, /CP501|CP14|CP503|CP504|LT11/i);
    assert.doesNotMatch(ladder, PLAYBOOK_RE);

    const activeCount = await db.knowledgeSource.count({ where: { isActive: true } });
    assert.ok(activeCount >= 16, `expected >=16 active knowledge sources, got ${activeCount}`);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-AF-IDENTIFY-CP501-KB.md"), "utf8"),
      /Package AF/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*AF\*\*.*CP501|mid-collection|identify/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-af"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-af/);
  } finally {
    await db.$disconnect();
  }

  console.log("phase-package-af-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
