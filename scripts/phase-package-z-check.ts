/**
 * Package Z — Identify-only KB expansion + embed backfill readiness.
 * Run: npx tsx scripts/phase-package-z-check.ts
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

const Z_TITLES = [
  "CP503 — Reminder of balance due",
  "CP504 — Urgent notice / intent to levy warning",
  "Wage and Income transcript — when and why",
  "Identifying an IRS notice",
] as const;

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  for (const title of Z_TITLES) {
    assert.match(seed, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Package Z — identify-only expansion/);

  // Each Package Z block must be identify-only (no playbook menus).
  for (const title of Z_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = seed.match(new RegExp(`title: "${escaped}"[\\s\\S]*?content: "([^"]+)"`))?.[1] ?? "";
    assert.ok(block.length > 40, `missing content for ${title}`);
    assert.doesNotMatch(block, PLAYBOOK_RE);
    assert.match(block, /Account Transcript|transcript|identify|Establish|Confirm/i);
  }

  const { db } = await import("../src/lib/db");
  const { knowledgeSourceWriteData } = await import("../src/lib/knowledge-authority-seed");

  const rows = [
    {
      title: "CP503 — Reminder of balance due",
      sourceType: "notice_guide",
      reference: "CP503",
      tags: "notice, balance due, reminder, collection",
      content:
        "A CP503 is typically a reminder that a balance remains unpaid after an earlier balance-due notice. It restates tax, penalties, and interest and urges a response. Confirm the printed amount, tax period, and any respond-by language on the notice. Compare those figures to an Account Transcript before deciding what to do next. This guide identifies the notice — it does not choose a payment or relief path.",
    },
    {
      title: "CP504 — Urgent notice / intent to levy warning",
      sourceType: "notice_guide",
      reference: "CP504",
      tags: "notice, balance due, urgent, levy warning, collection",
      content:
        "A CP504 is an urgent collection notice that the IRS may levy if the balance is not addressed. It usually lists the amount due and a short response window. Calendar any printed deadline, keep the notice, and confirm the account position on an Account Transcript. A later LT11 / Letter 1058 is the final levy notice with Collection Due Process hearing rights — do not confuse the two. Establish what the IRS shows before choosing a response path.",
    },
    {
      title: "Wage and Income transcript — when and why",
      sourceType: "rule",
      reference: "Wage & Income transcript",
      tags: "transcript, wage and income, w-2, 1099, unfiled, evidence",
      content:
        "A Wage & Income transcript lists information returns the IRS received from payers (W-2s, 1099s, and similar) for a tax year. Use it to reconstruct income for unfiled years, to check whether a CP2000 proposed amount matches payer reports, or to see what the IRS already has on file. It does not replace an Account Transcript for balances, assessments, or payments. Request it through your IRS individual online account or Form 4506-T. Identify the tax year first, then pull Wage & Income alongside the Account Transcript when amount or filing status is still unknown.",
    },
    {
      title: "Identifying an IRS notice",
      sourceType: "rule",
      reference: "Notice identity",
      tags: "notice, identify, cp, lt, deadline, evidence",
      content:
        "Most IRS notices print a CP or LT code near the top, a tax period, amounts, and often a respond-by date. Read the code first (for example CP14, CP503, CP504, CP2000, LT11), then the period and printed figures. Keep the notice and calendar any deadline shown. An Account Transcript independently confirms assessments, payments, and recent activity for the same periods. Until the notice code, period, and IRS account position are established, do not treat any guide as selecting a specific resolution path.",
    },
  ];

  const createdIds: string[] = [];
  try {
    for (const row of rows) {
      const write = knowledgeSourceWriteData(row);
      const exists = await db.knowledgeSource.findFirst({ where: { title: row.title } });
      if (!exists) {
        const created = await db.knowledgeSource.create({
          data: { title: row.title, ...write, isActive: true },
        });
        createdIds.push(created.id);
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

    const cp503 = await retrieveKnowledgeForQuery(
      "I received a CP503 reminder of balance due — what does it mean?",
    );
    assert.match(cp503, /CP503/i);
    assert.doesNotMatch(cp503, PLAYBOOK_RE);
    assert.match(cp503, /Account Transcript|identify/i);

    const cp504 = await retrieveKnowledgeForQuery(
      "I got a CP504 urgent notice about levy — what should I know?",
    );
    assert.match(cp504, /CP504/i);
    assert.doesNotMatch(cp504, PLAYBOOK_RE);
    assert.match(cp504, /Account Transcript|LT11/i);

    const wage = await retrieveKnowledgeForQuery(
      "When should I get a Wage and Income transcript from the IRS?",
    );
    assert.match(wage, /Wage|Income|W-2|1099/i);
    assert.doesNotMatch(wage, PLAYBOOK_RE);

    const identify = await retrieveKnowledgeForQuery(
      "How do I identify which IRS notice I received and what to check first?",
    );
    assert.match(identify, /CP|LT|notice code|Account Transcript/i);
    assert.doesNotMatch(identify, PLAYBOOK_RE);

    const activeCount = await db.knowledgeSource.count({ where: { isActive: true } });
    assert.ok(activeCount >= 14, `expected >=14 active knowledge sources, got ${activeCount}`);

    // Embed backfill CLI still present (Package U); dry-run eligible includes new rows.
    assert.match(
      readFileSync(join(root, "scripts/knowledge-embed-backfill.ts"), "utf8"),
      /embedKnowledgeSourceById|dry-run|--dry-run/,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /backfill:knowledge-embed/);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-Z-IDENTIFY-KB-EMBED.md"), "utf8"),
      /Package Z/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*Z\*\*.*identify|KB|embed/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-z"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-z/);
  } finally {
    // Leave upserted Package Z rows in DB (seed content); only delete rows we uniquely created
    // if titles collide with unexpected probes — keep seeded titles.
    void createdIds;
    await db.$disconnect();
  }

  console.log("phase-package-z-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
