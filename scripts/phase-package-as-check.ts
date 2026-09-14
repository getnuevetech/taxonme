/**
 * Package AS — Identify-only CP515 / CP518 unfiled-return KB.
 * Run: npx tsx scripts/phase-package-as-check.ts
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

const AS_TITLES = [
  "CP515 — Request for tax return (unfiled)",
  "CP518 — Further unfiled-return notice",
  "CP515 / CP518 vs Substitute for Return (SFR) — identify which you have",
] as const;

const CP515 =
  "A CP515 is typically an IRS notice that a required tax return appears unfiled for a listed tax period. It asks you to file the return or explain why no return is due. It is an unfiled-return notice identity — not a balance-due collection ladder notice (such as CP14 or CP504) and not by itself a Substitute for Return (SFR) assessment. Confirm the printed tax period and any respond-by language on the notice. Pull an Account Transcript and, when income is unclear, a Wage & Income transcript for the same period. This guide identifies the notice — it does not choose a filing, payment, or relief path.";

const CP518 =
  "A CP518 is typically a further IRS notice that a required tax return still appears unfiled after earlier contact such as a CP515. It restates the tax period and urges a response. It remains an unfiled-return notice identity — not a final levy notice (LT11 / CP90) and not the same as an SFR assessment under IRC 6020(b). Calendar any printed deadline, keep the notice, and confirm filing and assessment activity on an Account Transcript for that period. This guide identifies the notice — it does not choose a filing, payment, or relief path.";

const VS_SPLIT =
  "CP515 and CP518 are unfiled-return notices: the IRS believes a required return is missing for a tax period and asks for the return or an explanation. A Substitute for Return (SFR) under IRC 6020(b) is a different identity — an IRS-prepared return that can create an assessment when the taxpayer did not file. Holding a CP515 or CP518 is not the same as having an SFR assessment on the Account Transcript. Read the CP code and tax period on the notice you hold, then confirm whether an SFR or original return posting appears on the Account Transcript. This guide separates unfiled-return notice identity from SFR assessment identity — it does not select a filing or collection resolution.";

const IDENTIFY =
  "Most IRS notices print a CP or LT code near the top, a tax period, amounts, and often a respond-by date. Read the code first (for example CP14, CP49, CP501, CP503, CP504, CP90, CP515, CP518, CP2501, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures. Keep the notice and calendar any deadline shown. An Account Transcript independently confirms assessments, payments, and recent activity for the same periods. Until the notice code, period, and IRS account position are established, do not treat any guide as selecting a specific resolution path.";

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  for (const title of AS_TITLES) {
    assert.match(seed, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Package AS — CP515 \/ CP518 unfiled-return identify-only/);

  for (const title of AS_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = seed.match(new RegExp(`title: "${escaped}"[\\s\\S]*?content:\\s*"([^"]+)"`))?.[1] ?? "";
    assert.ok(block.length > 40, `missing content for ${title}`);
    assert.doesNotMatch(block, PLAYBOOK_RE);
    assert.doesNotMatch(block, WIZARD_RE);
    assert.doesNotMatch(block, /Form\s*12153/i);
    assert.match(block, /Account Transcript|identify|Confirm|CP515|CP518|SFR/i);
  }

  const identifyBlock =
    seed.match(/title: "Identifying an IRS notice"[\s\S]*?content: "([^"]+)"/)?.[1] ?? "";
  assert.match(identifyBlock, /CP515/);
  assert.match(identifyBlock, /CP518/);
  assert.match(identifyBlock, /CP90/);

  const sfr =
    seed.match(/title: "Unfiled returns and substitute for return"[\s\S]*?content: "([^"]+)"/)?.[1] ??
    "";
  assert.match(sfr, /6020\(b\)|Substitute for Return/i);
  assert.doesNotMatch(sfr, /CP515/);

  const { db } = await import("../src/lib/db");
  const { knowledgeSourceWriteData } = await import("../src/lib/knowledge-authority-seed");

  const rows = [
    {
      title: "CP515 — Request for tax return (unfiled)",
      sourceType: "notice_guide",
      reference: "CP515",
      tags: "notice, cp515, unfiled, tax return, delinquency, identify, evidence",
      content: CP515,
    },
    {
      title: "CP518 — Further unfiled-return notice",
      sourceType: "notice_guide",
      reference: "CP518",
      tags: "notice, cp518, unfiled, tax return, delinquency, identify, evidence",
      content: CP518,
    },
    {
      title: "CP515 / CP518 vs Substitute for Return (SFR) — identify which you have",
      sourceType: "rule",
      reference: "CP515 vs CP518 vs SFR",
      tags: "cp515, cp518, sfr, substitute for return, unfiled, identify, notice identity, evidence",
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

    const cp515Hit = await retrieveKnowledgeForQuery(
      "What is an IRS CP515 request for tax return unfiled notice?",
    );
    assert.match(cp515Hit, /CP515/i);
    assert.doesNotMatch(cp515Hit, PLAYBOOK_RE);
    assert.doesNotMatch(cp515Hit, /Form\s*12153/i);
    assert.match(cp515Hit, /Account Transcript|unfiled|identify/i);

    const cp518Hit = await retrieveKnowledgeForQuery(
      "What is an IRS CP518 further unfiled return notice?",
    );
    assert.match(cp518Hit, /CP518/i);
    assert.doesNotMatch(cp518Hit, PLAYBOOK_RE);

    const vsHit = await retrieveKnowledgeForQuery(
      "What is the difference between a CP515 and a Substitute for Return SFR?",
    );
    assert.match(vsHit, /CP515|CP518/i);
    assert.match(vsHit, /SFR|Substitute for Return/i);
    assert.doesNotMatch(vsHit, PLAYBOOK_RE);

    const activeCount = await db.knowledgeSource.count({ where: { isActive: true } });
    assert.ok(activeCount >= 28, `expected >=28 active knowledge sources, got ${activeCount}`);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-AS-IDENTIFY-CP515-KB.md"), "utf8"),
      /Package AS/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*AS\*\*.*CP515|unfiled/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-as"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-as/);

    console.log("phase-package-as-check: ok");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
