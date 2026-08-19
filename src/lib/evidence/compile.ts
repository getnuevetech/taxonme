import "server-only";
import { db } from "../db";
import { classifyDocument } from "./classify";
import { compileDocumentEvents, compileDocumentFacts, compileNarrativeFacts } from "./facts";
import { countTransactionRowCandidates, parseTranscript } from "./transcript";
import { countPages } from "./extraction-cache";
import { reconcileCaseEvidence } from "./reconcile";
import { PROCESSING_STATUS, PROVENANCE, FACT_KEYS, type EvidenceFactInput } from "./types";

// Evidence compilation runs before any tax reasoning. It is deterministic on
// purpose: dedupe, classify, read, and record what the documents say, so later
// stages reason about compiled evidence instead of re-reading raw uploads.

type CaseDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  docKind: string;
  contentHash: string;
  extractedJson: string;
  uploadedAt: Date;
};

export type EvidenceCompileResult = {
  documentsTotal: number;
  documentsProcessed: number;
  duplicatesResolved: number;
  factsCompiled: number;
  eventsCompiled: number;
  periodsReconstructed: number;
  processingFailures: string[];
  relationshipsFound: number;
  confirmedRelationships: number;
  calculationsPerformed: number;
};

function storedText(doc: { extractedJson: string }): string {
  try {
    const parsed = JSON.parse(doc.extractedJson || "{}");
    const raw = parsed?.raw_text;
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

function latestBalanceFact(facts: { valueNumber: number | null; effectiveDate: Date | null; id: string }[]) {
  return [...facts]
    .sort((a, b) => (b.effectiveDate?.getTime() ?? 0) - (a.effectiveDate?.getTime() ?? 0))
    .find((fact) => typeof fact.valueNumber === "number");
}

export async function compileCaseEvidence(
  caseId: string,
  opts?: { readDocumentText?: (doc: CaseDocument) => Promise<string> },
): Promise<EvidenceCompileResult> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "asc" } } },
  });
  if (!c) {
    return {
      documentsTotal: 0,
      documentsProcessed: 0,
      duplicatesResolved: 0,
      factsCompiled: 0,
      eventsCompiled: 0,
      periodsReconstructed: 0,
      processingFailures: [],
      relationshipsFound: 0,
      confirmedRelationships: 0,
      calculationsPerformed: 0,
    };
  }

  // Identical uploads are one piece of evidence, not two.
  const canonicalByHash = new Map<string, string>();
  let duplicatesResolved = 0;
  for (const doc of c.documents) {
    if (!doc.contentHash) continue;
    const canonicalId = canonicalByHash.get(doc.contentHash);
    if (!canonicalId) {
      canonicalByHash.set(doc.contentHash, doc.id);
      if (doc.duplicateOfId) await db.document.update({ where: { id: doc.id }, data: { duplicateOfId: null } });
      continue;
    }
    duplicatesResolved++;
    if (doc.duplicateOfId !== canonicalId) {
      await db.document.update({ where: { id: doc.id }, data: { duplicateOfId: canonicalId } });
    }
  }

  const canonicalDocs = c.documents.filter((doc) => !doc.contentHash || canonicalByHash.get(doc.contentHash) === doc.id);
  const processingFailures: string[] = [];
  const factInputs: EvidenceFactInput[] = [];
  const eventRows: {
    taxPeriod: string;
    eventType: string;
    transactionCode: string;
    description: string;
    eventDate: Date | null;
    amount: number | null;
    balanceEffect: string;
    provenance: string;
  }[] = [];
  let documentsProcessed = 0;

  for (const doc of canonicalDocs) {
    const text = (await opts?.readDocumentText?.(doc)) ?? storedText(doc);
    const classification = classifyDocument({ fileName: doc.fileName, mimeType: doc.mimeType, text, docKind: doc.docKind });
    const rowsDetected = text ? countTransactionRowCandidates(text) : 0;
    const rowsExtracted = text ? parseTranscript(text).transactions.length : 0;
    const pages = countPages(text);
    const tablesDetected = rowsDetected > 0 ? 1 : 0;
    const tablesProcessed = rowsExtracted > 0 ? 1 : 0;
    const pagesIncomplete = pages.expected > 0 && pages.processed < pages.expected;
    const status = !text
      ? PROCESSING_STATUS.PARTIAL
      : rowsDetected > rowsExtracted || pagesIncomplete
        ? PROCESSING_STATUS.PARTIAL
        : PROCESSING_STATUS.COMPLETE;
    if (status !== PROCESSING_STATUS.COMPLETE) {
      processingFailures.push(
        !text
          ? `${doc.fileName}: no machine-readable text extracted yet`
          : pagesIncomplete
            ? `${doc.fileName}: ${pages.expected - pages.processed} page(s) of ${pages.expected} not processed`
            : `${doc.fileName}: ${rowsDetected - rowsExtracted} transaction row(s) detected but not extracted`,
      );
    }
    if (status === PROCESSING_STATUS.COMPLETE) documentsProcessed++;

    await db.document.update({
      where: { id: doc.id },
      data: {
        documentType: classification.documentType,
        documentFamily: classification.documentFamily,
        classificationConfidence: classification.confidence,
        taxPeriodsJson: JSON.stringify(classification.taxPeriods),
        pagesExpected: pages.expected,
        pagesProcessed: pages.processed,
        tablesDetected,
        tablesProcessed,
        transactionRowsDetected: rowsDetected,
        transactionRowsExtracted: rowsExtracted,
        processingStatus: status,
        processingNotesJson: JSON.stringify(status === PROCESSING_STATUS.COMPLETE ? [] : processingFailures.slice(-1)),
      },
    });

    if (!text) continue;
    factInputs.push(
      ...compileDocumentFacts({
        documentId: doc.id,
        documentType: classification.documentType,
        text,
        taxPeriods: classification.taxPeriods,
      }),
    );
    eventRows.push(
      ...compileDocumentEvents({
        documentId: doc.id,
        documentType: classification.documentType,
        text,
        taxPeriods: classification.taxPeriods,
      }).map((event) => ({
        taxPeriod: event.taxPeriod ?? "",
        eventType: event.eventType,
        transactionCode: event.transactionCode ?? "",
        description: event.description ?? "",
        eventDate: event.eventDate ?? null,
        amount: event.amount ?? null,
        balanceEffect: event.balanceEffect ?? "unknown",
        provenance: event.provenance ?? PROVENANCE.DOCUMENT_EXTRACTED,
      })),
    );
  }

  factInputs.push(...compileNarrativeFacts(c.situation, c.goal));

  // Recompiling replaces the previous ledger for this case so stale facts can
  // never outlive the evidence they came from.
  await db.evidenceFact.deleteMany({ where: { caseId } });
  await db.caseEvent.deleteMany({ where: { caseId } });
  if (factInputs.length > 0) {
    await db.evidenceFact.createMany({
      data: factInputs.map((fact) => ({
        caseId,
        documentId: fact.documentId ?? null,
        factKey: fact.factKey,
        subject: fact.subject ?? "",
        factType: fact.factType ?? "",
        valueText: fact.valueText ?? "",
        valueNumber: fact.valueNumber ?? null,
        unit: fact.unit ?? "",
        taxPeriod: fact.taxPeriod ?? "",
        effectiveDate: fact.effectiveDate ?? null,
        recordDate: fact.recordDate ?? null,
        provenance: fact.provenance,
        sourceId: fact.sourceId ?? "",
        sourcePage: fact.sourcePage ?? null,
        sourceField: fact.sourceField ?? "",
        metadataJson: JSON.stringify(fact.metadata ?? {}),
      })),
    });
  }
  if (eventRows.length > 0) {
    await db.caseEvent.createMany({ data: eventRows.map((event) => ({ caseId, ...event })) });
  }

  const periods = await reconstructAccountStates(caseId);
  const reconciliation = await reconcileCaseEvidence(caseId);

  return {
    documentsTotal: c.documents.length,
    documentsProcessed,
    duplicatesResolved,
    factsCompiled: factInputs.length,
    eventsCompiled: eventRows.length,
    periodsReconstructed: periods,
    processingFailures,
    relationshipsFound: reconciliation.relationshipsFound,
    confirmedRelationships: reconciliation.confirmedRelationships,
    calculationsPerformed: reconciliation.calculationsPerformed,
  };
}

// Per-period position derived from the compiled ledger. Balances are only ever
// taken from the most recent record that states one.
export async function reconstructAccountStates(caseId: string): Promise<number> {
  const [facts, events] = await Promise.all([
    db.evidenceFact.findMany({ where: { caseId, taxPeriod: { not: "" } } }),
    db.caseEvent.findMany({ where: { caseId, taxPeriod: { not: "" } } }),
  ]);
  const periods = Array.from(new Set([...facts.map((f) => f.taxPeriod), ...events.map((e) => e.taxPeriod)].filter(Boolean)));
  await db.accountPeriodState.deleteMany({ where: { caseId, taxPeriod: { notIn: periods.length ? periods : ["__none__"] } } });

  for (const period of periods) {
    const periodFacts = facts.filter((f) => f.taxPeriod === period);
    const periodEvents = events.filter((e) => e.taxPeriod === period);
    const balance = latestBalanceFact(
      periodFacts.filter((f) => f.factKey === FACT_KEYS.ACCOUNT_BALANCE).map((f) => ({ id: f.id, valueNumber: f.valueNumber, effectiveDate: f.effectiveDate })),
    );
    const state = {
      refunds: periodEvents.filter((e) => e.eventType === "REFUND_ISSUED").map((e) => ({ amount: e.amount, date: e.eventDate })),
      transfers_out: periodEvents.filter((e) => e.eventType === "CREDIT_TRANSFERRED_OUT").map((e) => ({ amount: e.amount, date: e.eventDate })),
      transfers_in: periodEvents.filter((e) => e.eventType === "CREDIT_TRANSFERRED_IN").map((e) => ({ amount: e.amount, date: e.eventDate })),
      payments: periodEvents.filter((e) => e.eventType === "PAYMENT_RECEIVED").map((e) => ({ amount: e.amount, date: e.eventDate })),
      penalties: periodEvents.filter((e) => e.eventType === "PENALTY_OR_INTEREST_ASSESSED").map((e) => ({ amount: e.amount, date: e.eventDate })),
      holds: periodEvents.filter((e) => e.eventType === "ACCOUNT_HOLD").length,
      event_count: periodEvents.length,
    };
    await db.accountPeriodState.upsert({
      where: { caseId_taxPeriod: { caseId, taxPeriod: period } },
      update: {
        currentBalance: balance?.valueNumber ?? null,
        currentBalanceAsOf: balance?.effectiveDate ?? null,
        currentStatus: balance ? "balance_established" : periodEvents.length ? "activity_recorded" : "period_identified",
        stateJson: JSON.stringify(state),
        supportingFactIdsJson: JSON.stringify(periodFacts.map((f) => f.id)),
      },
      create: {
        caseId,
        taxPeriod: period,
        currentBalance: balance?.valueNumber ?? null,
        currentBalanceAsOf: balance?.effectiveDate ?? null,
        currentStatus: balance ? "balance_established" : periodEvents.length ? "activity_recorded" : "period_identified",
        stateJson: JSON.stringify(state),
        supportingFactIdsJson: JSON.stringify(periodFacts.map((f) => f.id)),
      },
    });
  }
  return periods.length;
}
