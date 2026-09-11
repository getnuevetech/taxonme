/**
 * Package AL — Identify-only Letter 3172 / NFTL KB.
 * Run: npx tsx scripts/phase-package-al-check.ts
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
  /how to (complete|fill|file|mail)|line[- ]by[- ]line|mail (the )?form to|checkbox|step \d|hearing strateg|lien (release|withdrawal|discharge|subordination) (wizard|steps|how to)/i;

const AL_TITLES = [
  "Letter 3172 — Notice of Federal Tax Lien Filing",
  "Notice of Federal Tax Lien (NFTL) — identify",
  "Letter 3172 / NFTL vs LT11 / Form 12153 — identify which you have",
] as const;

const LETTER_3172 =
  "Letter 3172 notifies that the IRS has filed a Notice of Federal Tax Lien (NFTL) and typically states Collection Due Process hearing rights related to that lien filing. It is a lien-notice identity, not a final levy notice (LT11 / Letter 1058) and not Form 12153. Calendar any printed deadline on the Letter 3172 you actually received, keep the letter with any NFTL paperwork, and confirm the balance and recent activity on an Account Transcript. This guide identifies the letter — it does not walk through requesting a hearing, releasing a lien, or choosing a payment path.";

const NFTL =
  "A Notice of Federal Tax Lien (NFTL) is a public filing that records the IRS claim against a taxpayer's property for unpaid tax. Letter 3172 is the common taxpayer letter that the NFTL was filed and that hearing rights may apply. An NFTL is not the same as an LT11 / Letter 1058 final intent-to-levy notice, and it is not Form 12153. Confirm tax periods and account position on an Account Transcript; calendar any deadline printed on the Letter 3172 or other lien notice you hold. This guide identifies the NFTL — it does not select a lien release, withdrawal, discharge, or balance-resolution path.";

const VS_SPLIT =
  "Letter 3172 and the Notice of Federal Tax Lien (NFTL) concern lien filing and related hearing-notice identity. An LT11 / Letter 1058 is a final notice of intent to levy that offers Collection Due Process (CDP) rights tied to levy action. Form 12153 is a separate request form used to ask for a CDP hearing (or an equivalent hearing when rules allow) after a qualifying levy or lien notice. Holding Letter 3172 or an NFTL is not the same as holding an LT11, and none of those is the same as having requested a hearing with Form 12153. Read the letter or notice code and any printed deadline first, then confirm the Account Transcript. This guide separates lien, levy, and form identities — it does not complete Form 12153 or select a collection resolution.";

const IDENTIFY =
  "Most IRS notices print a CP or LT code near the top, a tax period, amounts, and often a respond-by date. Read the code first (for example CP14, CP501, CP503, CP504, CP90, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures. Keep the notice and calendar any deadline shown. An Account Transcript independently confirms assessments, payments, and recent activity for the same periods. Until the notice code, period, and IRS account position are established, do not treat any guide as selecting a specific resolution path.";

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  for (const title of AL_TITLES) {
    assert.match(seed, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Package AL — Letter 3172 \/ NFTL identify-only/);

  for (const title of AL_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = seed.match(new RegExp(`title: "${escaped}"[\\s\\S]*?content:\\s*"([^"]+)"`))?.[1] ?? "";
    assert.ok(block.length > 40, `missing content for ${title}`);
    assert.doesNotMatch(block, PLAYBOOK_RE);
    assert.doesNotMatch(block, WIZARD_RE);
    assert.match(block, /Account Transcript|Calendar|identify|Confirm|Letter 3172|NFTL/i);
  }

  const identifyBlock =
    seed.match(/title: "Identifying an IRS notice"[\s\S]*?content: "([^"]+)"/)?.[1] ?? "";
  assert.match(identifyBlock, /Letter 3172/);
  assert.match(identifyBlock, /CP501/);
  assert.match(identifyBlock, /CP3219A/);

  const lt11 =
    seed.match(/title: "LT11 \/ Letter 1058 — Final notice of intent to levy"[\s\S]*?content: "([^"]+)"/)?.[1] ??
    "";
  assert.match(lt11, /30 days/);
  assert.match(lt11, /Form 12153/);
  assert.match(seed, /Package AI — CDP \/ Form 12153 identify-only/);

  const { db } = await import("../src/lib/db");
  const { knowledgeSourceWriteData } = await import("../src/lib/knowledge-authority-seed");

  const rows = [
    {
      title: "Letter 3172 — Notice of Federal Tax Lien Filing",
      sourceType: "notice_guide",
      reference: "Letter 3172",
      tags: "letter 3172, nftl, federal tax lien, lien notice, identify, evidence, deadline",
      content: LETTER_3172,
    },
    {
      title: "Notice of Federal Tax Lien (NFTL) — identify",
      sourceType: "rule",
      reference: "NFTL",
      tags: "nftl, notice of federal tax lien, lien, letter 3172, identify, evidence",
      content: NFTL,
    },
    {
      title: "Letter 3172 / NFTL vs LT11 / Form 12153 — identify which you have",
      sourceType: "rule",
      reference: "Letter 3172 vs LT11 vs Form 12153",
      tags: "letter 3172, nftl, lt11, form 12153, cdp, identify, notice vs form, evidence",
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

    const letterHit = await retrieveKnowledgeForQuery(
      "What is IRS Letter 3172 about a federal tax lien?",
    );
    assert.match(letterHit, /Letter 3172|NFTL|federal tax lien/i);
    assert.doesNotMatch(letterHit, PLAYBOOK_RE);
    assert.doesNotMatch(letterHit, WIZARD_RE);
    assert.match(letterHit, /Account Transcript|identify|Calendar/i);

    const nftlHit = await retrieveKnowledgeForQuery("What is a Notice of Federal Tax Lien (NFTL)?");
    assert.match(nftlHit, /NFTL|Notice of Federal Tax Lien/i);
    assert.doesNotMatch(nftlHit, PLAYBOOK_RE);
    assert.doesNotMatch(nftlHit, WIZARD_RE);

    const vsHit = await retrieveKnowledgeForQuery(
      "What is the difference between Letter 3172, an LT11, and Form 12153?",
    );
    assert.match(vsHit, /Letter 3172|NFTL/i);
    assert.match(vsHit, /LT11/);
    assert.match(vsHit, /Form 12153/);
    assert.doesNotMatch(vsHit, PLAYBOOK_RE);

    const activeCount = await db.knowledgeSource.count({ where: { isActive: true } });
    assert.ok(activeCount >= 24, `expected >=24 active knowledge sources, got ${activeCount}`);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-AL-IDENTIFY-NFTL-3172-KB.md"), "utf8"),
      /Package AL/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*AL\*\*.*3172|NFTL|federal tax lien/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-al"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-al/);
  } finally {
    await db.$disconnect();
  }

  console.log("phase-package-al-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
