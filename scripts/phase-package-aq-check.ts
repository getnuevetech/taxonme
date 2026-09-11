/**
 * Package AQ — Identify-only CP90 / ACS final-levy KB.
 * Run: npx tsx scripts/phase-package-aq-check.ts
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

const WIZARD_RE =
  /how to (complete|fill|file|mail)|line[- ]by[- ]line|mail (the )?form to|checkbox|step \d|hearing strateg/i;

const AQ_TITLES = [
  "CP90 — Final notice of intent to levy (ACS)",
  "CP90 vs LT11 / Letter 1058 vs CP504 — identify which you have",
] as const;

const CP90 =
  "A CP90 is typically an Automated Collection System (ACS) final notice of intent to levy that notifies of Collection Due Process (CDP) hearing rights. It is a final levy-notice identity in the same rights family as LT11 / Letter 1058, not a mid-ladder reminder and not a CP504 urgent warning alone. Calendar any printed deadline on the CP90 you hold, keep the notice, and confirm the balance and recent activity on an Account Transcript. Form 12153 is the named CDP hearing-request form — holding a CP90 is not the same as having filed Form 12153. This guide identifies the notice — it does not walk through completing Form 12153 or choosing a payment path.";

const VS_SPLIT =
  "A CP90 is an ACS final notice of intent to levy that offers Collection Due Process (CDP) hearing rights. An LT11 / Letter 1058 is the field-collection final levy notice in the same CDP-rights family — different letter codes, same need to calendar the printed deadline. A CP504 is an earlier urgent collection / levy-warning notice on the balance-due ladder; it is not by itself the CDP final levy notice. Read the CP/LT code and any respond-by date on the copy you hold, then confirm the Account Transcript. This guide separates CP90, LT11, and CP504 identities — it does not complete Form 12153 or select a collection resolution.";

const IDENTIFY =
  "Most IRS notices print a CP or LT code near the top, a tax period, amounts, and often a respond-by date. Read the code first (for example CP14, CP501, CP503, CP504, CP90, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures. Keep the notice and calendar any deadline shown. An Account Transcript independently confirms assessments, payments, and recent activity for the same periods. Until the notice code, period, and IRS account position are established, do not treat any guide as selecting a specific resolution path.";

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  for (const title of AQ_TITLES) {
    assert.match(seed, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Package AQ — CP90 \/ ACS final-levy identify-only/);

  for (const title of AQ_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = seed.match(new RegExp(`title: "${escaped}"[\\s\\S]*?content:\\s*"([^"]+)"`))?.[1] ?? "";
    assert.ok(block.length > 40, `missing content for ${title}`);
    assert.doesNotMatch(block, PLAYBOOK_RE);
    assert.doesNotMatch(block, WIZARD_RE);
    assert.match(block, /Account Transcript|Calendar|identify|Confirm|CP90/i);
  }

  const identifyBlock =
    seed.match(/title: "Identifying an IRS notice"[\s\S]*?content: "([^"]+)"/)?.[1] ?? "";
  assert.match(identifyBlock, /CP90/);
  assert.match(identifyBlock, /Letter 3172/);
  assert.match(identifyBlock, /CP501/);

  const lt11 =
    seed.match(/title: "LT11 \/ Letter 1058 — Final notice of intent to levy"[\s\S]*?content: "([^"]+)"/)?.[1] ??
    "";
  assert.match(lt11, /30 days/);
  assert.match(lt11, /Form 12153/);
  assert.doesNotMatch(lt11, /CP90/);

  const { db } = await import("../src/lib/db");
  const { knowledgeSourceWriteData } = await import("../src/lib/knowledge-authority-seed");

  const rows = [
    {
      title: "CP90 — Final notice of intent to levy (ACS)",
      sourceType: "notice_guide",
      reference: "CP90",
      tags: "notice, cp90, levy, acs, collection due process, final notice, identify, evidence",
      content: CP90,
    },
    {
      title: "CP90 vs LT11 / Letter 1058 vs CP504 — identify which you have",
      sourceType: "rule",
      reference: "CP90 vs LT11 vs CP504",
      tags: "cp90, lt11, letter 1058, cp504, levy, cdp, identify, notice identity, evidence",
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
    assert.doesNotMatch(await retrieveKnowledgeForQuery(THIN_FIXTURE), PLAYBOOK_RE);

    const cp90Hit = await retrieveKnowledgeForQuery(
      "What is an IRS CP90 final notice of intent to levy from ACS?",
    );
    assert.match(cp90Hit, /CP90/i);
    assert.doesNotMatch(cp90Hit, PLAYBOOK_RE);
    assert.doesNotMatch(cp90Hit, WIZARD_RE);
    assert.match(cp90Hit, /Account Transcript|identify|Calendar|CDP/i);

    const vsHit = await retrieveKnowledgeForQuery(
      "What is the difference between a CP90, an LT11, and a CP504?",
    );
    assert.match(vsHit, /CP90/i);
    assert.match(vsHit, /LT11/);
    assert.match(vsHit, /CP504/);
    assert.doesNotMatch(vsHit, PLAYBOOK_RE);

    const activeCount = await db.knowledgeSource.count({ where: { isActive: true } });
    assert.ok(activeCount >= 26, `expected >=26 active knowledge sources, got ${activeCount}`);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-AQ-IDENTIFY-CP90-KB.md"), "utf8"),
      /Package AQ/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*AQ\*\*.*CP90|ACS final/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-aq"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-aq/);

    console.log("phase-package-aq-check: ok");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
