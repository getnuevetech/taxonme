/**
 * Package AU — Identify-only CP2501 underreporter soft-notice KB.
 * Run: npx tsx scripts/phase-package-au-check.ts
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

const AU_TITLES = [
  "CP2501 — Underreporter soft notice",
  "CP2501 vs CP2000 vs CP3219A — identify which you have",
] as const;

const CP2501 =
  "A CP2501 is typically an earlier underreporter contact: the IRS compared third-party payer information to the return and asks you to review a possible mismatch before a formal CP2000 proposed-adjustment notice. It is a soft underreporter-notice identity — not a bill by itself, not a field audit, and not a Statutory Notice of Deficiency (CP3219A). Confirm the printed tax period, proposed figures if any, and any respond-by language. Compare those figures to a Wage & Income transcript and confirm account activity on an Account Transcript. This guide identifies the notice — it does not choose a payment or relief path.";

const VS_SPLIT =
  "A CP2501 is typically an earlier soft underreporter notice asking you to review a possible payer-information mismatch. A CP2000 is a proposed underreporter adjustment notice with proposed changes — still not a bill by itself. A CP3219A is a Statutory Notice of Deficiency that generally opens a limited Tax Court petition window — calendar any printed petition deadline. Read the CP code and tax period on the copy you hold, then confirm figures on Wage & Income and Account Transcripts. This guide separates CP2501, CP2000, and CP3219A identities — it does not select a response or collection resolution.";

const IDENTIFY =
  "Most IRS notices print a CP or LT code near the top, a tax period, amounts, and often a respond-by date. Read the code first (for example CP14, CP501, CP503, CP504, CP90, CP515, CP518, CP2501, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures. Keep the notice and calendar any deadline shown. An Account Transcript independently confirms assessments, payments, and recent activity for the same periods. Until the notice code, period, and IRS account position are established, do not treat any guide as selecting a specific resolution path.";

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  for (const title of AU_TITLES) {
    assert.match(seed, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Package AU — CP2501 underreporter soft-notice identify-only/);

  for (const title of AU_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = seed.match(new RegExp(`title: "${escaped}"[\\s\\S]*?content:\\s*"([^"]+)"`))?.[1] ?? "";
    assert.ok(block.length > 40, `missing content for ${title}`);
    assert.doesNotMatch(block, PLAYBOOK_RE);
    assert.doesNotMatch(block, WIZARD_RE);
    assert.doesNotMatch(block, /Form\s*12153/i);
    assert.match(block, /Account Transcript|Wage|identify|Confirm|CP2501/i);
  }

  const identifyBlock =
    seed.match(/title: "Identifying an IRS notice"[\s\S]*?content: "([^"]+)"/)?.[1] ?? "";
  assert.match(identifyBlock, /CP2501/);
  assert.match(identifyBlock, /CP515/);
  assert.match(identifyBlock, /CP2000/);

  const ladder =
    seed.match(
      /title: "Underreporter notice ladder — identify the stage"[\s\S]*?content: "([^"]+)"/,
    )?.[1] ?? "";
  assert.match(ladder, /CP2000.*CP3219A|CP3219A/);
  assert.doesNotMatch(ladder, /CP2501/);

  const { db } = await import("../src/lib/db");
  const { knowledgeSourceWriteData } = await import("../src/lib/knowledge-authority-seed");

  const rows = [
    {
      title: "CP2501 — Underreporter soft notice",
      sourceType: "notice_guide",
      reference: "CP2501",
      tags: "notice, cp2501, underreporter, examination, soft notice, identify, evidence",
      content: CP2501,
    },
    {
      title: "CP2501 vs CP2000 vs CP3219A — identify which you have",
      sourceType: "rule",
      reference: "CP2501 vs CP2000 vs CP3219A",
      tags: "cp2501, cp2000, cp3219a, underreporter, examination, identify, notice identity, evidence",
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

    const cp2501Hit = await retrieveKnowledgeForQuery(
      "What is an IRS CP2501 underreporter soft notice?",
    );
    assert.match(cp2501Hit, /CP2501/i);
    assert.doesNotMatch(cp2501Hit, PLAYBOOK_RE);
    assert.doesNotMatch(cp2501Hit, /Form\s*12153/i);
    assert.match(cp2501Hit, /Account Transcript|Wage|identify|CP2000/i);

    const vsHit = await retrieveKnowledgeForQuery(
      "What is the difference between a CP2501, a CP2000, and a CP3219A?",
    );
    assert.match(vsHit, /CP2501/i);
    assert.match(vsHit, /CP2000/);
    assert.match(vsHit, /CP3219A/);
    assert.doesNotMatch(vsHit, PLAYBOOK_RE);

    const activeCount = await db.knowledgeSource.count({ where: { isActive: true } });
    assert.ok(activeCount >= 30, `expected >=30 active knowledge sources, got ${activeCount}`);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-AU-IDENTIFY-CP2501-KB.md"), "utf8"),
      /Package AU/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*AU\*\*.*CP2501|underreporter soft/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-au"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-au/);

    console.log("phase-package-au-check: ok");
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
