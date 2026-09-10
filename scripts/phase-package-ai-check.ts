/**
 * Package AI — Identify-only Form 12153 / CDP KB.
 * Run: npx tsx scripts/phase-package-ai-check.ts
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

const AI_TITLES = [
  "Form 12153 — Request for Collection Due Process hearing",
  "Collection Due Process (CDP) hearing rights — identify",
  "LT11 notice vs Form 12153 — identify which you have",
] as const;

const FORM_12153_CONTENT =
  "Form 12153 is the IRS form used to request a Collection Due Process (CDP) hearing — or, when rules allow after the CDP window, an equivalent hearing. It is a hearing-request form identity, not a payment arrangement, settlement, or financial statement. CDP rights are typically offered on a final levy notice such as LT11 / Letter 1058 (or certain lien notices); that notice grants the rights and prints the respond-by window, while Form 12153 is the named request form. Calendar any deadline on the levy or lien notice you actually received, keep that notice with the form identity, and confirm the balance and recent activity on an Account Transcript. This guide identifies the form and the right — it does not walk through completing or filing Form 12153, and it does not choose a resolution path.";

const CDP_CONTENT =
  "Collection Due Process (CDP) hearing rights let a taxpayer ask IRS Appeals for an independent review of certain collection actions after a qualifying notice — most often a final notice of intent to levy (LT11 / Letter 1058) or a notice of federal tax lien. The printed deadline on that notice is the first evidence to calendar; the CDP request window is generally short (often about 30 days from the notice date). Form 12153 is the named request form for a CDP or equivalent hearing; it is not the levy notice itself. Confirm the notice code, notice date, tax periods, and account position on an Account Transcript before treating any guide as selecting arguments or a balance resolution. This guide identifies CDP rights — it is not a hearing-preparation or form-filing wizard.";

const LT11_VS_CONTENT =
  "An LT11 / Letter 1058 is a final notice of intent to levy that notifies of Collection Due Process (CDP) hearing rights and usually prints a respond-by date. Form 12153 is a separate request form used to ask for a CDP hearing (or an equivalent hearing when rules allow). Holding an LT11 is not the same as having requested a hearing with Form 12153; seeing Form 12153 language is not the same as holding the levy notice that started the deadline. Read the notice code and deadline on any LT11 first, identify whether Form 12153 is the form in question, and confirm the Account Transcript. This guide separates notice identity from form identity — it does not complete the form or select a collection resolution.";

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  for (const title of AI_TITLES) {
    assert.match(seed, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(seed, /Package AI — CDP \/ Form 12153 identify-only/);

  for (const title of AI_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const block = seed.match(new RegExp(`title: "${escaped}"[\\s\\S]*?content:\\s*"([^"]+)"`))?.[1] ?? "";
    assert.ok(block.length > 40, `missing content for ${title}`);
    assert.doesNotMatch(block, PLAYBOOK_RE);
    assert.doesNotMatch(block, WIZARD_RE);
    assert.match(block, /Account Transcript|Calendar|identify|Confirm|Form 12153|CDP|LT11/i);
  }

  const formBlock =
    seed.match(
      /title: "Form 12153 — Request for Collection Due Process hearing"[\s\S]*?content:\s*"([^"]+)"/,
    )?.[1] ?? "";
  assert.match(formBlock, /Form 12153/);
  assert.match(formBlock, /LT11|Letter 1058/);

  const cdpBlock =
    seed.match(
      /title: "Collection Due Process \(CDP\) hearing rights — identify"[\s\S]*?content:\s*"([^"]+)"/,
    )?.[1] ?? "";
  assert.match(cdpBlock, /Form 12153/);
  assert.match(cdpBlock, /Account Transcript/);

  const vsBlock =
    seed.match(
      /title: "LT11 notice vs Form 12153 — identify which you have"[\s\S]*?content:\s*"([^"]+)"/,
    )?.[1] ?? "";
  assert.match(vsBlock, /LT11/);
  assert.match(vsBlock, /Form 12153/);
  assert.match(vsBlock, /not the same|separate|vs/i);

  // Y LT11 unchanged
  const lt11 =
    seed.match(/title: "LT11 \/ Letter 1058 — Final notice of intent to levy"[\s\S]*?content: "([^"]+)"/)?.[1] ??
    "";
  assert.match(lt11, /30 days/);
  assert.match(lt11, /Form 12153/);

  // AH still present
  assert.match(seed, /Package AH — examination identify-only/);
  assert.match(seed, /CP3219A — Statutory Notice of Deficiency/);

  const { db } = await import("../src/lib/db");
  const { knowledgeSourceWriteData } = await import("../src/lib/knowledge-authority-seed");

  const rows = [
    {
      title: "Form 12153 — Request for Collection Due Process hearing",
      sourceType: "rule",
      reference: "Form 12153",
      tags: "form 12153, cdp, collection due process, hearing request, identify, evidence",
      content: FORM_12153_CONTENT,
    },
    {
      title: "Collection Due Process (CDP) hearing rights — identify",
      sourceType: "rule",
      reference: "CDP hearing rights",
      tags: "cdp, collection due process, hearing rights, lt11, deadline, identify, evidence",
      content: CDP_CONTENT,
    },
    {
      title: "LT11 notice vs Form 12153 — identify which you have",
      sourceType: "rule",
      reference: "LT11 vs Form 12153",
      tags: "lt11, letter 1058, form 12153, cdp, identify, notice vs form, evidence",
      content: LT11_VS_CONTENT,
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

    const formHit = await retrieveKnowledgeForQuery("What is Form 12153 for a CDP hearing?");
    assert.match(formHit, /Form 12153|CDP/i);
    assert.doesNotMatch(formHit, PLAYBOOK_RE);
    assert.doesNotMatch(formHit, WIZARD_RE);
    assert.match(formHit, /Account Transcript|identify|LT11/i);

    const cdpHit = await retrieveKnowledgeForQuery("What are Collection Due Process hearing rights?");
    assert.match(cdpHit, /CDP|Collection Due Process/i);
    assert.doesNotMatch(cdpHit, PLAYBOOK_RE);
    assert.doesNotMatch(cdpHit, WIZARD_RE);

    const vsHit = await retrieveKnowledgeForQuery(
      "What is the difference between an LT11 and Form 12153?",
    );
    assert.match(vsHit, /LT11/);
    assert.match(vsHit, /Form 12153/);
    assert.doesNotMatch(vsHit, PLAYBOOK_RE);

    const activeCount = await db.knowledgeSource.count({ where: { isActive: true } });
    assert.ok(activeCount >= 21, `expected >=21 active knowledge sources, got ${activeCount}`);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-AI-IDENTIFY-CDP-12153-KB.md"), "utf8"),
      /Package AI/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*AI\*\*.*12153|CDP|Collection Due Process/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ai"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ai/);
  } finally {
    await db.$disconnect();
  }

  console.log("phase-package-ai-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
