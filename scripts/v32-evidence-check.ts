import Module from "node:module";
import assert from "node:assert/strict";

// Focused end-to-end check for the v3.2 evidence slice. Run with tsx.
const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

const TRANSCRIPT = `ACCOUNT TRANSCRIPT
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
  const { nextClarifyQuestion } = await import("../src/lib/clarify");

  const email = `v32-evidence-${Date.now()}@example.com`;
  let userId: string | null = null;
  try {
    const user = await db.user.create({ data: { email, role: "user", status: "active" } });
    userId = user.id;
    const c = await db.case.create({
      data: {
        userId: user.id,
        title: "v3.2 evidence check",
        situation: "The IRS says I owe money for a past tax year and I uploaded my account transcript.",
        goal: "Understand what I owe and what to do next.",
        status: "analyzed",
      },
    });

    const hash = "identical-hash-for-duplicate-test";
    const canonical = await db.document.create({
      data: {
        userId: user.id,
        caseId: c.id,
        fileName: "account-transcript.pdf",
        filePath: "fake-1.pdf",
        mimeType: "application/pdf",
        docKind: "other",
        contentHash: hash,
        extractedJson: JSON.stringify({ raw_text: TRANSCRIPT }),
      },
    });
    const duplicate = await db.document.create({
      data: {
        userId: user.id,
        caseId: c.id,
        fileName: "account-transcript-copy.pdf",
        filePath: "fake-2.pdf",
        mimeType: "application/pdf",
        docKind: "other",
        contentHash: hash,
        extractedJson: JSON.stringify({ raw_text: TRANSCRIPT }),
      },
    });

    const result = await compileCaseEvidence(c.id);
    assert.equal(result.duplicatesResolved, 1, "identical uploads must collapse to one evidence document");

    const duplicateRow = await db.document.findUnique({ where: { id: duplicate.id } });
    assert.equal(duplicateRow?.duplicateOfId, canonical.id, "duplicate must point at the canonical document");
    const canonicalRow = await db.document.findUnique({ where: { id: canonical.id } });
    assert.equal(canonicalRow?.documentType, "IRS_ACCOUNT_TRANSCRIPT", "transcript must be classified, not left as other");
    assert.equal(canonicalRow?.processingStatus, "complete");
    assert.ok((canonicalRow?.transactionRowsExtracted ?? 0) >= 3, "transaction rows must be extracted");

    const balanceFact = await db.evidenceFact.findFirst({ where: { caseId: c.id, factKey: "account_balance" } });
    assert.equal(balanceFact?.valueNumber, 2879, "account balance must be compiled from the transcript");
    assert.equal(balanceFact?.provenance, "DOCUMENT_EXTRACTED");

    const accountState = await db.accountPeriodState.findUnique({ where: { caseId_taxPeriod: { caseId: c.id, taxPeriod: "2023" } } });
    assert.equal(accountState?.currentBalance, 2879, "per-period account state must be reconstructed");

    const events = await db.caseEvent.findMany({ where: { caseId: c.id } });
    assert.ok(events.some((e) => e.eventType === "REFUND_ISSUED"), "refund event must be recorded");
    assert.ok(events.some((e) => e.eventType === "CREDIT_TRANSFERRED_OUT"), "credit transfer event must be recorded");

    // A balance question would normally be asked here; the transcript answers it.
    await db.issue.create({
      data: {
        caseId: c.id,
        issueType: "balance_due",
        title: "Balance due",
        description: "Reported balance owed.",
        unclearJson: JSON.stringify(["Exact IRS proposed balance"]),
      },
    });

    const question = await nextClarifyQuestion(c.id);
    assert.notEqual(question?.key, "balance_amount", "the customer must not be asked for a balance the transcript states");
    const suppressed = await db.suppressedQuestion.findMany({ where: { caseId: c.id } });
    assert.ok(suppressed.length > 0, "suppressed questions must be recorded for audit");

    // A credit that leaves one tax period should be matched to the period that
    // received it, across separate documents.
    await db.document.create({
      data: {
        userId: user.id,
        caseId: c.id,
        fileName: "account-transcript-2024.pdf",
        filePath: "fake-3.pdf",
        mimeType: "application/pdf",
        docKind: "other",
        contentHash: "second-period-hash",
        extractedJson: JSON.stringify({
          raw_text: `ACCOUNT TRANSCRIPT
TAX PERIOD ENDING: Dec. 31, 2024
ACCOUNT BALANCE: 0.00
706 Credit transferred in 05-01-2024 $2,620.07`,
        }),
      },
    });
    const reconciled = await compileCaseEvidence(c.id);
    assert.ok(reconciled.relationshipsFound > 0, "reconciliation must run over the compiled ledgers");

    const transfer = await db.evidenceRelationship.findFirst({
      where: { caseId: c.id, relationshipType: "CROSS_PERIOD_TRANSFER" },
    });
    assert.ok(transfer, "a credit transferred between tax periods must be identified");
    assert.equal(transfer?.status, "CONFIRMED");
    assert.equal(transfer?.amount, 2620.07);
    assert.notEqual(transfer?.fromTaxPeriod, transfer?.toTaxPeriod, "a cross-period transfer must link two periods");

    const calculated = await db.evidenceFact.findFirst({ where: { caseId: c.id, provenance: "SYSTEM_CALCULATED" } });
    assert.ok(calculated, "deterministic calculations must be recorded as evidence");

    // A document we cannot read is a processing failure, not taxpayer doubt.
    const { runCaseAnalysis } = await import("../src/lib/ai/orchestrator");
    const unreadable = await db.document.create({
      data: {
        userId: user.id,
        caseId: c.id,
        fileName: "unreadable-scan.pdf",
        filePath: "missing-file-on-disk.pdf",
        mimeType: "application/pdf",
        docKind: "other",
        contentHash: "unreadable-hash",
      },
    });
    await runCaseAnalysis(c.id, { trigger: "manual_reanalysis_requested" });

    const unreadableRow = await db.document.findUnique({ where: { id: unreadable.id } });
    assert.equal(unreadableRow?.processingStatus, "failed", "an unreadable document must be recorded as a processing failure");
    assert.ok(
      JSON.parse(unreadableRow?.processingNotesJson || "[]").length > 0,
      "processing failures must carry an explanation",
    );

    const version = await db.caseAnalysisVersion.findFirst({ where: { caseId: c.id }, orderBy: { version: "desc" } });
    const snapshot = JSON.parse(version?.snapshotJson || "{}");
    assert.ok(snapshot.evidence_state, "analysis snapshot must record the evidence state");
    assert.equal(snapshot.evidence_state.duplicatesResolved, 1, "duplicate accounting must survive a full analysis run");

    console.log(
      `v3.2 evidence check passed — facts: ${reconciled.factsCompiled}, events: ${reconciled.eventsCompiled}, periods: ${reconciled.periodsReconstructed}, suppressed: ${suppressed.length}, relationships: ${reconciled.relationshipsFound} (${reconciled.confirmedRelationships} confirmed), calculations: ${reconciled.calculationsPerformed}, processing failures recorded: ${snapshot.evidence_state.processingFailures?.length ?? 0}`,
    );
  } finally {
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main();
