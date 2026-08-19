import Module from "node:module";
import assert from "node:assert";

// Proves that the evidence a case establishes actually reaches the surfaces that
// speak to the customer, and that a letter cannot state a figure it does not.
const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

const TRANSCRIPT_2023 = `ACCOUNT TRANSCRIPT
TAX PERIOD ENDING: Dec. 31, 2023
ACCOUNT BALANCE: 2,879.00
AS OF: Mar. 10, 2026
150 Tax return filed 04-15-2024 $5,000.00
806 W-2 withholding 04-15-2024 -$7,879.00
826 Credit transferred out 05-01-2024 -$2,620.07
846 Refund issued 05-10-2024 -$427.93`;

async function main() {
  const db = (await import("../src/lib/db")).db;
  const { compileCaseEvidence } = await import("../src/lib/evidence/compile");
  const { runEvidenceAudit } = await import("../src/lib/evidence/audit");
  const { buildEvidenceBrief, buildLatestCaseBrief, emptyEvidenceBrief } = await import("../src/lib/evidence/brief");
  const { unsupportedAmounts, statedAmounts } = await import("../src/lib/evidence/letter-guard");

  const email = `v32-surfaces-${Date.now()}@example.com`;
  let userId: string | null = null;
  try {
    const user = await db.user.create({ data: { email, role: "user", status: "active" } });
    userId = user.id;
    const c = await db.case.create({
      data: {
        userId: user.id,
        title: "v3.2 surfaces check",
        situation: "The IRS says I owe money for 2023 and I think my refund was about $5,000.",
        goal: "Understand what I owe and respond.",
        status: "analyzed",
      },
    });
    await db.document.create({
      data: {
        userId: user.id,
        caseId: c.id,
        fileName: "account-transcript-2023.pdf",
        filePath: "surfaces-1.pdf",
        mimeType: "application/pdf",
        docKind: "other",
        contentHash: `surfaces-${Date.now()}`,
        extractedJson: JSON.stringify({ raw_text: TRANSCRIPT_2023 }),
      },
    });

    await compileCaseEvidence(c.id);
    await runEvidenceAudit(c.id);

    const brief = await buildEvidenceBrief(c.id);
    assert.equal(brief.hasEvidence, true, "a case with a transcript must produce a usable brief");
    assert.match(brief.text, /\$2,879\.00/, "the established balance must reach every downstream surface");
    assert.match(brief.text, /Tax period 2023/, "the brief must tie the position to its tax period");
    assert.match(brief.text, /State no dollar figure/, "the brief must forbid figures it does not contain");
    assert.ok(
      brief.statableAmounts.some((v) => Math.abs(v) === 2879),
      "the established balance must be statable downstream",
    );

    // The customer's own belief travels as a belief, never as the record.
    const reportedBlock = brief.text.split("REPORTED BY THE CUSTOMER, NOT ESTABLISHED")[1] ?? "";
    if (brief.reportedNotEstablished.length > 0) {
      assert.ok(reportedBlock.length > 0, "user-reported facts must be quarantined under their own heading");
    }

    // The safety property: a drafted letter cannot assert an invented figure.
    const groundedDraft = "Your records show a balance of $2,879.00 for tax year 2023.";
    const inventedDraft = "Your records show a balance of $9,100.00 for tax year 2023.";
    const context = "I want to dispute the balance the IRS says I owe.";
    const allowed = [...brief.statableAmounts, ...statedAmounts(context)];
    assert.deepEqual(unsupportedAmounts(groundedDraft, allowed), [], "a figure from the transcript must pass");
    assert.deepEqual(unsupportedAmounts(inventedDraft, allowed), [9100], "an invented figure must be caught before it is sent");

    // Chat reads from the same record as the analysis.
    const latest = await buildLatestCaseBrief(user.id);
    assert.equal(latest.caseId, c.id, "the assistant must ground itself in the customer's open case");
    assert.equal(latest.brief.text, brief.text, "every surface must read the same record");

    // With no case there is nothing established, and nothing may be asserted.
    const noUser = await buildLatestCaseBrief(null);
    assert.equal(noUser.caseId, null);
    assert.equal(noUser.brief.hasEvidence, false);
    assert.equal(noUser.brief.text, emptyEvidenceBrief().text);
    assert.deepEqual(unsupportedAmounts("You owe $1,200.00.", noUser.brief.statableAmounts), [1200]);

    console.log(
      `v3.2 surfaces check passed — statable amounts: ${brief.statableAmounts.length}, ` +
        `established facts: ${brief.establishedFacts.length}, open unknowns: ${brief.openUnknowns.length}, ` +
        `positions: ${brief.establishedPositions.map((p) => `${p.taxPeriod}=${p.balance}`).join(", ")}`,
    );
  } finally {
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main();
