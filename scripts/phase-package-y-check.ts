/**
 * Package Y — Authority seed honesty (identify-only notice/SFR seeds + playbook gates).
 * Run: npx tsx scripts/phase-package-y-check.ts
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

async function main() {
  const root = process.cwd();
  const {
    authorityGateOptsFromQuery,
    authoritySourceBlockedByGates,
    RESOLUTION_PLAYBOOK_RE,
    shouldRetrieveResolutionPlaybooks,
  } = await import("../src/lib/authority-gates");

  const thinGate = authorityGateOptsFromQuery(THIN_FIXTURE);
  assert.equal(thinGate.allowInstallmentThresholds, false);
  assert.equal(thinGate.allowResolutionPlaybooks, false);

  const playbookCp14 = {
    title: "CP14 — Balance due notice",
    tags: "notice, balance due",
    content:
      "Options: short-term payment plan, long-term installment agreement (Form 9465), currently-not-collectible, or offer in compromise.",
    taxYear: null as number | null,
  };
  assert.equal(
    authoritySourceBlockedByGates(playbookCp14, {
      allowInstallmentThresholds: thinGate.allowInstallmentThresholds,
      allowNamedRelief: thinGate.allowNamedRelief,
      allowResolutionPlaybooks: thinGate.allowResolutionPlaybooks,
      caseTaxYear: thinGate.snap.caseTaxYear,
    }),
    true,
  );
  assert.equal(RESOLUTION_PLAYBOOK_RE.test(playbookCp14.content), true);

  const identifyLt11 = {
    title: "LT11 / Letter 1058 — Final notice of intent to levy",
    tags: "levy, urgent, collection, due process",
    content:
      "LT11 is a final notice of intent to levy and notice of Collection Due Process hearing rights. Calendar the printed deadline and confirm the balance on an Account Transcript.",
    taxYear: null as number | null,
  };
  assert.equal(
    authoritySourceBlockedByGates(identifyLt11, {
      allowInstallmentThresholds: thinGate.allowInstallmentThresholds,
      allowNamedRelief: thinGate.allowNamedRelief,
      allowResolutionPlaybooks: thinGate.allowResolutionPlaybooks,
      caseTaxYear: thinGate.snap.caseTaxYear,
    }),
    false,
  );

  const oicAsk = "How does an IRS Offer in Compromise work?";
  const oicGate = authorityGateOptsFromQuery(oicAsk);
  assert.equal(oicGate.allowResolutionPlaybooks, true);
  assert.equal(shouldRetrieveResolutionPlaybooks(oicGate.snap), true);

  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  assert.match(seed, /establish what the IRS shows first/i);
  assert.match(seed, /Calendar the printed deadline/i);
  assert.match(seed, /Establish which years are unfiled/i);
  assert.doesNotMatch(
    seed.match(/title: "CP14[\s\S]*?title: "CP49/)?.[0] ?? "",
    /Form 9465|currently-not-collectible|offer in compromise/i,
  );
  assert.doesNotMatch(
    seed.match(/title: "LT11[\s\S]*?title: "IRS account transcript/)?.[0] ?? "",
    /installment agreement|payment arrangements/i,
  );
  assert.doesNotMatch(
    seed.match(/title: "Unfiled returns[\s\S]*?\},\s*\]/)?.[0] ?? "",
    /installment agreements and offers in compromise/i,
  );

  // Directly upsert the three rewritten rows from seed literals via db for the live retrieval assert.
  const { db } = await import("../src/lib/db");
  const rewrites = [
    {
      title: "CP14 — Balance due notice",
      content:
        "A CP14 is typically the IRS's first balance-due notice after assessment. It lists tax assessed, credits, penalties, and interest, and usually asks for payment within about 21 days of the notice date. Confirm the printed amount, tax period, and respond-by language on the notice. An Account Transcript establishes the same figures independently. Interest and failure-to-pay penalties generally continue until the balance is resolved. Do not choose a specific payment or relief path from this guide alone — establish what the IRS shows first.",
    },
    {
      title: "LT11 / Letter 1058 — Final notice of intent to levy",
      content:
        "LT11 (Letter 1058) is a final notice of intent to levy and notice of Collection Due Process (CDP) hearing rights. The taxpayer generally has 30 days from the notice date to request a CDP hearing (Form 12153) or otherwise respond before levy of wages, bank accounts, or other property may proceed. Calendar the printed deadline and keep the notice. Confirm the balance and recent activity on an Account Transcript. Professional review is often warranted at this stage because levy timing is short.",
    },
    {
      title: "Unfiled returns and substitute for return",
      content:
        "When a required return is not filed, the IRS may prepare a Substitute for Return (SFR) under IRC 6020(b) using payer information, often with filing status and deductions that overstate tax relative to a complete original return. Filing an accurate original return generally replaces the SFR assessment for that period. Refund claims remain subject to statute of limitations (commonly within 3 years of the return due date or 2 years of payment). Getting compliant for required open years (often discussed with reference to IRS Policy Statement 5-133) is usually a prerequisite before evaluating any later collection or relief options. Establish which years are unfiled and what the Account Transcript shows before sizing next steps.",
    },
  ];
  for (const row of rewrites) {
    const exists = await db.knowledgeSource.findFirst({ where: { title: row.title } });
    if (exists) {
      await db.knowledgeSource.update({
        where: { id: exists.id },
        data: { content: row.content, embeddingJson: "", embeddingModel: "", embeddedAt: null },
      });
    }
  }

  try {
    const { retrieveKnowledgeForQuery } = await import("../src/lib/authority-retrieval");
    const thinHits = await retrieveKnowledgeForQuery(THIN_FIXTURE);
    assert.doesNotMatch(thinHits, PLAYBOOK_RE);

    const lt11Hits = await retrieveKnowledgeForQuery(
      "I received an LT11 Final Notice of Intent to Levy and need to understand what it means.",
    );
    if (lt11Hits) {
      assert.match(lt11Hits, /LT11|levy|1058|CDP/i);
      assert.doesNotMatch(lt11Hits, PLAYBOOK_RE);
    }

    const eduHits = await retrieveKnowledgeForQuery(
      "Please explain how an IRS installment agreement / payment plan works, including the $50,000 streamlined threshold.",
    );
    if (eduHits) {
      assert.match(eduHits, /installment|payment plan|9465|streamlined|50,?000/i);
    }

    const gatesSrc = readFileSync(join(root, "src/lib/authority-gates.ts"), "utf8");
    assert.match(gatesSrc, /RESOLUTION_PLAYBOOK_RE/);
    assert.match(gatesSrc, /allowResolutionPlaybooks/);
    assert.match(gatesSrc, /Package Y/);

    const retrievalSrc = readFileSync(join(root, "src/lib/authority-retrieval.ts"), "utf8");
    assert.match(retrievalSrc, /allowResolutionPlaybooks/);

    assert.match(
      readFileSync(join(root, "docs/v5.1/PACKAGE-Y-AUTHORITY-SEED-HONESTY.md"), "utf8"),
      /Package Y/i,
    );
    assert.match(
      readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
      /\*\*Y\*\*.*seed|authority|honesty/i,
    );
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-y"/);
    assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-y/);
  } finally {
    await db.$disconnect();
  }

  console.log("phase-package-y-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
