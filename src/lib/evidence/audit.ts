import "server-only";
import { db } from "../db";
import { auditEvidence, type AuditUnknown, type EvidenceAuditReport } from "./audit-core";
import type { KnownFact } from "./unknowns";

// Runs the evidence gate for one analysis cycle: tracks the case's unknowns,
// retires the ones existing evidence answers, and records the audit so both the
// pipeline and admin diagnostics can see whether evidence was actually used.

export type EvidenceAuditResult = {
  status: string;
  report: EvidenceAuditReport;
  unknownsResolved: number;
  unknownsRemaining: number;
};

function unknownsFromIssues(issues: { id: string; title: string; unclearJson: string }[]): AuditUnknown[] {
  const unknowns: AuditUnknown[] = [];
  for (const issue of issues) {
    let items: string[] = [];
    try {
      const parsed = JSON.parse(issue.unclearJson || "[]");
      if (Array.isArray(parsed)) items = parsed.map(String).filter(Boolean);
    } catch {
      items = [];
    }
    for (const [index, text] of items.entries()) {
      unknowns.push({ key: `issue:${issue.id}:${index}`, label: text.slice(0, 150), text });
    }
  }
  return unknowns;
}

export async function runEvidenceAudit(
  caseId: string,
  analysisVersionId?: string,
  opts?: { persist?: boolean },
): Promise<EvidenceAuditResult> {
  const persist = opts?.persist ?? true;
  const [documents, facts, issues, relationshipCount, calculationCount] = await Promise.all([
    db.document.findMany({ where: { caseId, deletedAt: null } }),
    db.evidenceFact.findMany({
      where: { caseId },
      select: { id: true, factKey: true, provenance: true, valueText: true, valueNumber: true, taxPeriod: true, documentId: true },
    }),
    db.issue.findMany({ where: { caseId }, select: { id: true, title: true, unclearJson: true } }),
    db.evidenceRelationship.count({ where: { caseId } }),
    db.evidenceFact.count({ where: { caseId, provenance: "SYSTEM_CALCULATED" } }),
  ]);

  const factCountByDocument = new Map<string, number>();
  for (const fact of facts) {
    if (!fact.documentId) continue;
    factCountByDocument.set(fact.documentId, (factCountByDocument.get(fact.documentId) ?? 0) + 1);
  }

  const knownFacts: KnownFact[] = facts.map((fact) => ({
    id: fact.id,
    factKey: fact.factKey,
    provenance: fact.provenance,
    valueText: fact.valueText,
    valueNumber: fact.valueNumber,
    taxPeriod: fact.taxPeriod,
  }));

  const unknowns = unknownsFromIssues(issues);
  const report = auditEvidence({
    documents: documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      documentType: doc.documentType,
      processingStatus: doc.processingStatus,
      verificationStatus: doc.verificationStatus,
      duplicateOfId: doc.duplicateOfId,
      transactionRowsDetected: doc.transactionRowsDetected,
      transactionRowsExtracted: doc.transactionRowsExtracted,
      factCount: factCountByDocument.get(doc.id) ?? 0,
    })),
    unknowns,
    facts: knownFacts,
    relationshipCount,
    calculationCount,
  });

  // Persist the unknown list so resolution is auditable rather than implicit.
  const resolvedKeys = new Set(report.unknownsResolvedByExistingEvidence.map((item) => item.key));
  if (!persist) {
    return {
      status: report.status,
      report,
      unknownsResolved: resolvedKeys.size,
      unknownsRemaining: report.remainingMaterialUnknowns.length,
    };
  }
  for (const unknown of unknowns) {
    const resolved = report.unknownsResolvedByExistingEvidence.find((item) => item.key === unknown.key);
    await db.caseUnknown.upsert({
      where: { caseId_unknownKey: { caseId, unknownKey: unknown.key } },
      update: {
        label: unknown.label,
        question: unknown.text,
        status: resolved ? "RESOLVED_BY_EXISTING_EVIDENCE" : "ACTIVE",
        resolvedValue: resolved?.resolvedValue ?? "",
        reason: resolved ? "Answered by evidence already on file." : "",
        supportingFactIdsJson: JSON.stringify(resolved?.supportingFactIds ?? []),
      },
      create: {
        caseId,
        unknownKey: unknown.key,
        label: unknown.label,
        question: unknown.text,
        status: resolved ? "RESOLVED_BY_EXISTING_EVIDENCE" : "ACTIVE",
        resolvedValue: resolved?.resolvedValue ?? "",
        reason: resolved ? "Answered by evidence already on file." : "",
        supportingFactIdsJson: JSON.stringify(resolved?.supportingFactIds ?? []),
      },
    }).catch(() => null);
  }
  // Unknowns that no longer appear in the analysis are stale, not answered.
  await db.caseUnknown.deleteMany({
    where: { caseId, unknownKey: { notIn: unknowns.length ? unknowns.map((u) => u.key) : ["__none__"] } },
  });

  await db.evidenceAudit.create({
    data: {
      caseId,
      analysisVersionId: analysisVersionId ?? null,
      status: report.status,
      documentsTotal: documents.length,
      documentsProcessed: documents.filter((doc) => doc.processingStatus === "complete").length,
      documentsVerified: documents.filter((doc) => doc.verificationStatus === "verified").length,
      duplicatesResolved: documents.filter((doc) => doc.duplicateOfId).length,
      factsCompiled: facts.length,
      unknownsResolved: resolvedKeys.size,
      unknownsRemaining: report.remainingMaterialUnknowns.length,
      reportJson: JSON.stringify(report),
    },
  });

  return {
    status: report.status,
    report,
    unknownsResolved: resolvedKeys.size,
    unknownsRemaining: report.remainingMaterialUnknowns.length,
  };
}
