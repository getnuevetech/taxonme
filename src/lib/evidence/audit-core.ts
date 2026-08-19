import { EVIDENCE_AUDIT_STATUS, PROCESSING_STATUS } from "./types";
import { resolveUnknownTextFromFacts, type KnownFact } from "./unknowns";

// The evidence auditor answers one question before any tax reasoning runs:
// have we actually used the evidence TaxOnMe already has? It is deterministic
// so the gate keeps working when no AI provider is configured.

export type AuditDocument = {
  id: string;
  fileName: string;
  documentType: string;
  processingStatus: string;
  verificationStatus: string;
  duplicateOfId: string | null;
  transactionRowsDetected: number;
  transactionRowsExtracted: number;
  factCount: number;
};

export type AuditUnknown = {
  key: string;
  label: string;
  text: string;
};

export type EvidenceAuditReport = {
  status: string;
  documentsChecked: string[];
  processingFailures: string[];
  unusedEvidence: string[];
  unresolvedExtractionConflicts: string[];
  unknownsResolvedByExistingEvidence: { key: string; label: string; resolvedValue: string; supportingFactIds: string[] }[];
  remainingMaterialUnknowns: { key: string; label: string }[];
  blockingConditions: string[];
  limitations: string[];
};

export function auditEvidence(input: {
  documents: AuditDocument[];
  unknowns: AuditUnknown[];
  facts: KnownFact[];
  relationshipCount: number;
  calculationCount: number;
}): EvidenceAuditReport {
  const canonical = input.documents.filter((doc) => !doc.duplicateOfId);
  const processingFailures: string[] = [];
  const unusedEvidence: string[] = [];
  const unresolvedExtractionConflicts: string[] = [];
  const limitations: string[] = [];

  for (const doc of canonical) {
    if (doc.processingStatus === PROCESSING_STATUS.FAILED) {
      processingFailures.push(`${doc.fileName}: extraction did not complete`);
      continue;
    }
    if (doc.processingStatus === PROCESSING_STATUS.PARTIAL) {
      limitations.push(`${doc.fileName}: only partially processed`);
    }
    if (doc.transactionRowsDetected > doc.transactionRowsExtracted) {
      limitations.push(`${doc.fileName}: ${doc.transactionRowsDetected - doc.transactionRowsExtracted} transaction row(s) not extracted`);
    }
    if (doc.verificationStatus === "verification_required") {
      unresolvedExtractionConflicts.push(`${doc.fileName}: independent extractions disagree on at least one field`);
    }
    // Evidence that was read but produced nothing is worth flagging: either the
    // document carries no material facts, or we failed to compile them.
    if (doc.processingStatus === PROCESSING_STATUS.COMPLETE && doc.factCount === 0) {
      unusedEvidence.push(`${doc.fileName}: processed but no facts were compiled`);
    }
  }

  // An unknown must not stay active when the evidence already answers it.
  const unknownsResolvedByExistingEvidence: EvidenceAuditReport["unknownsResolvedByExistingEvidence"] = [];
  const remainingMaterialUnknowns: EvidenceAuditReport["remainingMaterialUnknowns"] = [];
  for (const unknown of input.unknowns) {
    const resolution = resolveUnknownTextFromFacts(unknown.text, input.facts);
    if (resolution.suppressed) {
      unknownsResolvedByExistingEvidence.push({
        key: unknown.key,
        label: unknown.label,
        resolvedValue: resolution.resolvedValue,
        supportingFactIds: resolution.supportingFactIds,
      });
      continue;
    }
    remainingMaterialUnknowns.push({ key: unknown.key, label: unknown.label });
  }

  const blockingConditions: string[] = [];
  const failedCount = canonical.filter((doc) => doc.processingStatus === PROCESSING_STATUS.FAILED).length;
  if (canonical.length > 0 && failedCount === canonical.length) {
    blockingConditions.push("No uploaded document could be processed, so there is no evidence to reason about yet.");
  }

  const status = blockingConditions.length > 0
    ? EVIDENCE_AUDIT_STATUS.EVIDENCE_PROCESSING_INCOMPLETE
    : unresolvedExtractionConflicts.length > 0
      ? EVIDENCE_AUDIT_STATUS.HUMAN_DOCUMENT_REVIEW_REQUIRED
      : processingFailures.length > 0 || limitations.length > 0
        ? EVIDENCE_AUDIT_STATUS.EVIDENCE_READY_WITH_LIMITATIONS
        : EVIDENCE_AUDIT_STATUS.EVIDENCE_READY;

  return {
    status,
    documentsChecked: canonical.map((doc) => doc.id),
    processingFailures,
    unusedEvidence,
    unresolvedExtractionConflicts,
    unknownsResolvedByExistingEvidence,
    remainingMaterialUnknowns,
    blockingConditions,
    limitations,
  };
}

// Only a genuine processing failure stops tax reasoning. Partial evidence and
// items needing a human still produce an answer, with the limits stated.
export function blocksAnalysis(status: string): boolean {
  return status === EVIDENCE_AUDIT_STATUS.EVIDENCE_PROCESSING_INCOMPLETE;
}
