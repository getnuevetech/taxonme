/**
 * Package AH — Identify-only examination KB (CP2000 harden + CP3219A + ladder).
 * Run: npx tsx scripts/phase-package-ah-check.ts
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
  /installment\s+agreement|form\s*9465|payment\s+plan|offer\s+in\s+compromise|\bOIC\b|currently[\s-]?not[\s-]?collectible|\bCNC\b|\$\s?50,?000|\$\s?100,?000|Form\s*12153|Form\s*433/i;

const AH_TITLES = [
  "CP2000 — Underreported income notice",
  "CP3219A — Statutory Notice of Deficiency",
  "Underreporter notice ladder — identify the stage",
] as const;

const CP2000_CONTENT =
  "A CP2000 is an underreporter notice: the IRS compared third-party payer information (W-2s, 1099s, and similar) to the return and proposes changes. It is a proposed adjustment, not a bill by itself and not a field audit. Confirm the printed tax period, proposed amounts, and any respond-by date on your copy. Compare the proposed figures to a Wage & Income transcript and confirm account activity on an Account Transcript before sizing a response. Common mismatches include missing Form 1099 income, corrected W-2s, and brokerage cost-basis differences. If the matter is not resolved, the IRS may later issue a Statutory Notice of Deficiency (CP3219A). This guide identifies the notice — it does not choose a payment or relief path.";

const CP3219A_CONTENT =
  "A CP3219A is a Statutory Notice of Deficiency (often called a 90-day letter). It states a proposed deficiency and generally opens a limited window to petition the U.S. Tax Court — calendar the printed deadline and keep the notice. It is not the same as an LT11 final levy notice or Collection Due Process hearing rights. Confirm the tax period and proposed figures against any earlier underreporter notice and an Account Transcript. This guide identifies the notice — it does not choose a payment, settlement, or petition-filing path.";

const LADDER_CONTENT =
  "Underreporter mail often follows: CP2000 (proposed underreporter changes) → CP3219A (Statutory Notice of Deficiency with a Tax Court petition window). Read the CP code first, then the tax period, proposed amounts, and any respond-by or petition deadline. Wage & Income and Account Transcripts help verify what the IRS used. Knowing the stage is an identify step — do not treat the stage alone as selecting a resolution path, and do not confuse this track with the balance-due collection ladder ending in LT11.";

const IDENTIFY_CONTENT =
  "Most IRS notices print a CP or LT code near the top, a tax period, amounts, and often a respond-by date. Read the code first (for example CP14, CP501, CP503, CP504, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures. Keep the notice and calendar any deadline shown. An Account Transcript independently confirms assessments, payments, and recent activity for the same periods. Until the notice code, period, and IRS account position are established, do not treat any guide as selecting a specific resolution path.";

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  for (const title of AH_TITLES) {
    assert.match(seed, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Package AH — examination identify-only/);
  assert.match(seed, /CP2000, CP3219A, LT11/);

  const cp2000Block =
    seed.match(/title: "CP2000 — Underreported income notice"[\s\S]*?content: "([^"]+)"/)?.[1] ??
    "";
  assert.ok(cp2000Block.length > 40);
  assert.doesNotMatch(cp2000Block, PLAYBOOK_RE);
  assert.doesNotMatch(cp2000Block, /agree, partially agree, or disagree/i);
  assert.match(cp2000Block, /Wage|Account Transcript|CP3219A|identif/i);

  for (const title of ["CP3219A — Statutory Notice of Deficiency", "Underreporter notice ladder — identify the stage"] as const) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = seed.match(new RegExp(`title: "${escaped}"[\\s\\S]*?content: "([^"]+)"`))?.[1] ?? "";
    assert.ok(block.length > 40, `missing content for ${title}`);
    assert.doesNotMatch(block, PLAYBOOK_RE);
    assert.match(block, /Account Transcript|Wage|identify|Confirm|Calendar|Read the CP/i);
  }

  const identifyBlock =
    seed.match(/title: "Identifying an IRS notice"[\s\S]*?content: "([^"]+)"/)?.[1] ?? "";
  assert.match(identifyBlock, /CP3219A/);
  assert.match(identifyBlock, /CP501/);

  const { db } = await import("../src/lib/db");
  const { knowledgeSourceWriteData } = await import("../src/lib/knowledge-authority-seed");

  const rows = [
    {
      title: "CP2000 — Underreported income notice",
      sourceType: "notice_guide",
      reference: "CP2000",
      tags: "notice, underreported, income, proposed amount, examination, evidence",
      content: CP2000_CONTENT,
    },
    {
      title: "CP3219A — Statutory Notice of Deficiency",
      sourceType: "notice_guide",
      reference: "CP3219A",
      tags: "notice, deficiency, statutory, tax court, underreporter, examination, evidence",
      content: CP3219A_CONTENT,
    },
    {
      title: "Underreporter notice ladder — identify the stage",
      sourceType: "rule",
      reference: "Underreporter notice ladder",
      tags: "notice, identify, underreporter, cp2000, cp3219a, examination, evidence",
      content: LADDER_CONTENT,
    },
    {
      title: "Identifying an IRS notice",
      sourceType: "rule",
      reference: "Notice identity",
      tags: "notice, identify, cp, lt, deadline, evidence",
      content: IDENTIFY_CONTENT,
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

    const cp2000 = await retrieveKnowledgeForQuery("What is a CP2000?");
    assert.match(cp2000, /CP2000/i);
    assert.doesNotMatch(cp2000, PLAYBOOK_RE);
    assert.match(cp2000, /Wage|Account Transcript|identify/i);

    const cp3219a = await retrieveKnowledgeForQuery(
      "What is a CP3219A Statutory Notice of Deficiency?",
    );
    assert.match(cp3219a, /CP3219A|deficiency|Tax Court/i);
    assert.doesNotMatch(cp3219a, PLAYBOOK_RE);
    assert.doesNotMatch(cp3219a, /Form\s*12153|installment|OIC|CNC/i);

    const ladder = await retrieveKnowledgeForQuery(
      "What is the underreporter notice ladder from CP2000 to CP3219A?",
    );
    assert.match(ladder, /CP2000|CP3219A/i);
    assert.doesNotMatch(ladder, PLAYBOOK_RE);

    const activeCount = await db.knowledgeSource.count({ where: { isActive: true } });
    assert.ok(activeCount >= 18, `expected >=18 active knowledge sources, got ${activeCount}`);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-AH-IDENTIFY-EXAM-KB.md"), "utf8"),
      /Package AH/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*AH\*\*.*examination|CP3219A|underreporter/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ah"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ah/);
  } finally {
    await db.$disconnect();
  }

  console.log("phase-package-ah-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
