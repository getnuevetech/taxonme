/**
 * Package AW — Identify-only CP49 / TOP refund-offset KB.
 * Run: npx tsx scripts/phase-package-aw-check.ts
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
  /installment\s+agreement|form\s*9465|payment\s+plan|offer\s+in\s+compromise|\bOIC\b|currently[\s-]?not[\s-]?collectible|\bCNC\b|\$\s?50,?000|\$\s?100,?000|Form\s*433/i;

const AH_THIN_RE =
  /installment\s+agreement|form\s*9465|payment\s+plan|offer\s+in\s+compromise|\bOIC\b|currently[\s-]?not[\s-]?collectible|\bCNC\b|\$\s?50,?000|\$\s?100,?000|Form\s*12153|Form\s*433/i;

const WIZARD_RE =
  /how to (complete|fill|file|mail)|line[- ]by[- ]line|mail (the )?form to|checkbox|step \d|hearing strateg/i;

const AW_TITLES = [
  "CP49 — Refund applied to other taxes",
  "Treasury Offset Program (TOP) — refund offset identity",
  "CP49 vs TOP — identify which offset you have",
] as const;

const CP49 =
  "A CP49 tells you that all or part of an expected federal tax refund was applied (offset) to another federal tax debt — often a different tax year. It usually shows which period received the credit and any remaining refund. Confirm the printed periods and amounts on the notice, then compare Account Transcript activity (often including a credit transfer such as TC 826) for both the refund year and the year that received the offset. A CP49 is an IRS federal-tax offset notice identity — not a Treasury Offset Program (TOP) notice for non-IRS debts. This guide identifies the notice — it does not choose a payment or relief path.";

const TOP =
  "The Treasury Offset Program (TOP) can apply a federal tax refund to certain non-IRS debts such as past-due child support, state income tax, or federal student loans. TOP offsets are administered through the Bureau of the Fiscal Service and typically use a Fiscal Service notice — not an IRS CP49. Confirm what debt the Fiscal Service notice lists, then confirm IRS Account Transcript activity for the refund year to see whether an IRS federal-tax offset (CP49 / TC 826) also occurred. This guide identifies TOP offset identity — it does not choose a payment or relief path.";

const VS_SPLIT =
  "A CP49 is an IRS notice that a federal tax refund was applied to another federal tax liability. A TOP offset is a Bureau of the Fiscal Service action applying a refund to certain non-IRS debts (for example state tax, child support, or federal student loans) and uses a different notice. Holding a CP49 is not the same as receiving a TOP Fiscal Service notice, and either can reduce an expected refund. Read the notice issuer and debt description first, then confirm the refund year on an Account Transcript. This guide separates CP49 and TOP identities — it does not select a collection resolution.";

const IDENTIFY =
  "Most IRS notices print a CP or LT code near the top, a tax period, amounts, and often a respond-by date. Read the code first (for example CP14, CP49, CP501, CP503, CP504, CP90, CP515, CP518, CP2501, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures. Keep the notice and calendar any deadline shown. An Account Transcript independently confirms assessments, payments, and recent activity for the same periods. Until the notice code, period, and IRS account position are established, do not treat any guide as selecting a specific resolution path.";

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  for (const title of AW_TITLES) {
    assert.match(seed, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Package AW — harden identify-only|Package AW — TOP refund-offset identify-only/);

  for (const title of AW_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = seed.match(new RegExp(`title: "${escaped}"[\\s\\S]*?content:\\s*"([^"]+)"`))?.[1] ?? "";
    assert.ok(block.length > 40, `missing content for ${title}`);
    assert.doesNotMatch(block, PLAYBOOK_RE);
    assert.doesNotMatch(block, WIZARD_RE);
    assert.doesNotMatch(block, /Form\s*12153/i);
    assert.match(block, /Account Transcript|identify|Confirm|CP49|TOP/i);
  }

  const identifyBlock =
    seed.match(/title: "Identifying an IRS notice"[\s\S]*?content: "([^"]+)"/)?.[1] ?? "";
  assert.match(identifyBlock, /CP49/);
  assert.match(identifyBlock, /CP2501/);

  const { db } = await import("../src/lib/db");
  const { knowledgeSourceWriteData } = await import("../src/lib/knowledge-authority-seed");

  const rows = [
    {
      title: "CP49 — Refund applied to other taxes",
      sourceType: "notice_guide",
      reference: "CP49",
      tags: "notice, cp49, refund, offset, federal tax, identify, evidence",
      content: CP49,
    },
    {
      title: "Treasury Offset Program (TOP) — refund offset identity",
      sourceType: "rule",
      reference: "TOP refund offset",
      tags: "top, treasury offset program, refund, offset, fiscal service, identify, evidence",
      content: TOP,
    },
    {
      title: "CP49 vs TOP — identify which offset you have",
      sourceType: "rule",
      reference: "CP49 vs TOP",
      tags: "cp49, top, treasury offset program, refund, offset, identify, notice identity, evidence",
      content: VS_SPLIT,
    },
    {
      title: "Identifying an IRS notice",
      sourceType: "rule",
      reference: "Notice identity",
      tags: "notice, identify, cp, lt, deadline, evidence",
      content: IDENTIFY,
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
    assert.equal(authorityGateOptsFromQuery(THIN_FIXTURE).allowResolutionPlaybooks, false);

    const { retrieveKnowledgeForQuery } = await import("../src/lib/authority-retrieval");
    const thinHits = await retrieveKnowledgeForQuery(THIN_FIXTURE);
    assert.doesNotMatch(thinHits, PLAYBOOK_RE);
    assert.doesNotMatch(thinHits, AH_THIN_RE);

    const cp49Hit = await retrieveKnowledgeForQuery(
      "What is an IRS CP49 refund applied to other taxes notice?",
    );
    assert.match(cp49Hit, /CP49/i);
    assert.doesNotMatch(cp49Hit, PLAYBOOK_RE);
    assert.doesNotMatch(cp49Hit, /Form\s*12153/i);
    assert.match(cp49Hit, /Account Transcript|offset|identify|TOP/i);

    const topHit = await retrieveKnowledgeForQuery(
      "What is a Treasury Offset Program TOP refund offset?",
    );
    assert.match(topHit, /TOP|Treasury Offset|Fiscal Service/i);
    assert.doesNotMatch(topHit, PLAYBOOK_RE);

    const vsHit = await retrieveKnowledgeForQuery(
      "What is the difference between a CP49 and a TOP offset?",
    );
    assert.match(vsHit, /CP49/i);
    assert.match(vsHit, /TOP|Fiscal Service/i);
    assert.doesNotMatch(vsHit, PLAYBOOK_RE);

    const activeCount = await db.knowledgeSource.count({ where: { isActive: true } });
    assert.ok(activeCount >= 32, `expected >=32 active knowledge sources, got ${activeCount}`);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-AW-IDENTIFY-CP49-TOP-KB.md"), "utf8"),
      /Package AW/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*AW\*\*.*CP49|TOP|refund-offset/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-aw"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-aw/);

    console.log("phase-package-aw-check: ok");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
