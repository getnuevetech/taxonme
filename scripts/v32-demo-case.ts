import Module from "node:module";

// Creates a demo case whose evidence is compiled through the real v3.2 pipeline
// so the customer view can be inspected with genuine reconstructed data.
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

const TRANSCRIPT_2024 = `ACCOUNT TRANSCRIPT
TAX PERIOD ENDING: Dec. 31, 2024
ACCOUNT BALANCE: 0.00
AS OF: Mar. 10, 2026
706 Credit transferred in 05-01-2024 $2,620.07`;

async function main() {
  const bcrypt = (await import("bcryptjs")).default;
  const db = (await import("../src/lib/db")).db;
  const { compileCaseEvidence } = await import("../src/lib/evidence/compile");
  const { runEvidenceAudit } = await import("../src/lib/evidence/audit");
  const { synthesizeCaseReconstruction } = await import("../src/lib/evidence/synthesize");
  const { rebuildActionGraph } = await import("../src/lib/action-graph");

  const email = "v32-demo@example.com";
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, status: "active", role: "user", firstName: "Evidence", lastName: "Demo" },
    create: { email, passwordHash, status: "active", role: "user", firstName: "Evidence", lastName: "Demo" },
  });

  await db.case.deleteMany({ where: { userId: user.id, title: "v3.2 evidence demo" } });
  const c = await db.case.create({
    data: {
      userId: user.id,
      title: "v3.2 evidence demo",
      situation: "I owe the IRS for 2023 and I do not understand what happened to my refund.",
      goal: "Understand what I owe now and what to do next.",
      status: "analyzed",
      readinessScore: 68,
    },
  });

  for (const [name, text] of [["account-transcript-2023.pdf", TRANSCRIPT_2023], ["account-transcript-2024.pdf", TRANSCRIPT_2024]] as const) {
    await db.document.create({
      data: {
        userId: user.id,
        caseId: c.id,
        fileName: name,
        filePath: `${name}-stored`,
        mimeType: "application/pdf",
        docKind: "other",
        contentHash: `${name}-hash`,
        extractedJson: JSON.stringify({ raw_text: text }),
      },
    });
  }
  // A scanned upload we genuinely could not read.
  await db.document.create({
    data: {
      userId: user.id,
      caseId: c.id,
      fileName: "scanned-notice.pdf",
      filePath: "missing-scan.pdf",
      mimeType: "application/pdf",
      docKind: "notice",
      contentHash: "scan-hash",
      processingStatus: "failed",
      processingNotesJson: JSON.stringify(["scanned-notice.pdf: no machine-readable text extracted yet"]),
    },
  });

  await db.issue.create({
    data: {
      caseId: c.id,
      issueType: "balance_due",
      taxYear: 2023,
      title: "2023 balance remains open after a credit was applied",
      description: "The account records show a credit moved between tax years and a refund issued, leaving a balance for 2023.",
      priority: "high",
      state: "action_needed",
      itemKind: "issue",
      evidenceStatus: "likely",
      evidenceStrength: "moderate",
      conclusion: "A balance remains for 2023 after the credit transfer and refund.",
      unclearJson: JSON.stringify(["Whether a payment plan is already in place", "Which year received the transferred credit"]),
      explanationsJson: JSON.stringify([{ title: "Credit applied to another year", detail: "Part of the overpayment was moved to a different tax year.", likelihood: "Likely" }]),
      evidenceJson: JSON.stringify([
        { heading: "Your situation", detail: "You reported owing the IRS for 2023 and questioned your refund." },
        { heading: "Your evidence", detail: "Your account transcripts record the credit transfer and the refund issued." },
      ]),
    },
  });

  await db.pathStep.createMany({
    data: [
      { caseId: c.id, sortOrder: 0, title: "Verify the balance owed", description: "Establish the current amount due for 2023.", actionKey: "verify_balance", status: "current" },
      { caseId: c.id, sortOrder: 1, title: "Confirm the amount due", description: "Double-check the balance figure.", actionKey: "confirm_balance", status: "pending" },
      { caseId: c.id, sortOrder: 2, title: "Choose a resolution option", description: "Decide how to resolve the remaining 2023 balance.", actionKey: "select_resolution", status: "pending" },
    ],
  });

  const compiled = await compileCaseEvidence(c.id);
  await runEvidenceAudit(c.id);
  await synthesizeCaseReconstruction(c.id);
  await rebuildActionGraph(c.id);

  const { computeReadinessDimensions } = await import("../src/lib/evidence/readiness-core");
  const [docs, evidenceFacts, unknowns] = await Promise.all([
    db.document.findMany({ where: { caseId: c.id, deletedAt: null }, select: { fileName: true, processingStatus: true, duplicateOfId: true } }),
    db.evidenceFact.findMany({ where: { caseId: c.id }, select: { provenance: true } }),
    db.caseUnknown.findMany({ where: { caseId: c.id }, select: { status: true, label: true } }),
  ]);
  const readiness = computeReadinessDimensions({
    documents: docs,
    documentsExpected: 3,
    facts: evidenceFacts,
    unknowns,
    unresolvedConflicts: 0,
    irsSourcesMatched: 2,
  });
  await db.case.update({
    where: { id: c.id },
    data: {
      readinessScore: readiness.caseReadiness,
      evidenceAvailableScore: readiness.evidenceAvailable,
      evidenceProcessedScore: readiness.evidenceProcessed,
    },
  });

  console.log(JSON.stringify({ email, password: "ChangeMe123!", caseId: c.id, compiled, readiness }, null, 2));
  await db.$disconnect();
}

main();
