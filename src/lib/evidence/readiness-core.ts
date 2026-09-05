import { isEvidentiaryProvenance } from "./types";

/**
 * v3.2 separates three questions a single readiness percentage used to blur:
 *
 *  - evidenceAvailable: of what this case needs, how much has the customer given us?
 *  - evidenceProcessed: of what they gave us, how much did we successfully read?
 *  - caseReadiness:     how much of the case can we actually act on?
 *
 * The distinction matters because a document we failed to read is our gap, not
 * theirs. It must never reduce the customer's standing or read as though they
 * are withholding something.
 */
export type ReadinessDimensions = {
  evidenceAvailable: number;
  evidenceProcessed: number;
  caseReadiness: number;
  processingGap: boolean;
  documentsProvided: number;
  documentsRead: number;
  documentsUnread: number;
  openUnknowns: number;
  resolvedUnknowns: number;
  limitations: string[];
  customerBlockers: string[];
};

export type ReadinessDocument = {
  fileName: string;
  processingStatus: string;
  duplicateOfId?: string | null;
};

export type ReadinessFact = { provenance: string };

export type ReadinessUnknown = { status: string; label: string };

/** CaseUnknown uses ACTIVE in schema; OPEN kept as legacy alias. */
export function isOpenUnknownStatus(status: string): boolean {
  return status === "ACTIVE" || status === "OPEN" || status === "AWAITING_CUSTOMER";
}

export function readinessPresentationMode(input: {
  documentsProvided: number;
  evidentiaryFacts: number;
  caseTypeThin: boolean;
}): "checklist" | "percent" {
  if (input.caseTypeThin && input.documentsProvided === 0 && input.evidentiaryFacts === 0) {
    return "checklist";
  }
  return "percent";
}

function pct(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeReadinessDimensions(input: {
  documents: ReadinessDocument[];
  documentsExpected: number;
  facts: ReadinessFact[];
  unknowns: ReadinessUnknown[];
  unresolvedConflicts: number;
  irsSourcesMatched: number;
}): ReadinessDimensions {
  const canonical = input.documents.filter((d) => !d.duplicateOfId);
  const documentsProvided = canonical.length;
  const documentsRead = canonical.filter((d) => d.processingStatus === "complete").length;
  const documentsUnread = documentsProvided - documentsRead;

  const expected = Math.max(1, input.documentsExpected);
  const evidenceAvailable = pct((Math.min(documentsProvided, expected) / expected) * 100);
  // With nothing uploaded there is nothing for us to have processed, which is
  // not a processing failure — it reports as complete-on-our-side.
  const evidenceProcessed = documentsProvided === 0 ? 100 : pct((documentsRead / documentsProvided) * 100);

  const openUnknowns = input.unknowns.filter((u) => isOpenUnknownStatus(u.status)).length;
  const resolvedUnknowns = input.unknowns.length - openUnknowns;
  const evidentiaryFacts = input.facts.filter((f) => isEvidentiaryProvenance(f.provenance)).length;

  // Readiness measures what we can act on, so it is built from evidence we hold
  // and read. Documents we could not read are deliberately absent from this
  // calculation; they surface as a processing gap instead of a deduction.
  const readDocumentScore = documentsProvided === 0 ? 0 : (Math.min(documentsRead, expected) / expected) * 35;
  const factScore = Math.min(evidentiaryFacts, 8) * (30 / 8);
  const irsScore = Math.min(input.irsSourcesMatched, 3) * (15 / 3);
  const base = 15;
  const penalty = input.unresolvedConflicts * 8 + openUnknowns * 3;
  const caseReadiness = pct(readDocumentScore + factScore + irsScore + base - penalty);

  const limitations: string[] = [];
  if (documentsUnread > 0) {
    limitations.push(
      `${documentsUnread} of ${documentsProvided} document${documentsProvided === 1 ? "" : "s"} could not be read on our side yet.`,
    );
  }
  if (input.unresolvedConflicts > 0) {
    limitations.push(`${input.unresolvedConflicts} contradiction${input.unresolvedConflicts === 1 ? "" : "s"} still need resolving.`);
  }

  const customerBlockers = input.unknowns
    .filter((u) => u.status === "AWAITING_CUSTOMER" || u.status === "ACTIVE" || u.status === "OPEN")
    .map((u) => u.label)
    .filter(Boolean);

  return {
    evidenceAvailable,
    evidenceProcessed,
    caseReadiness,
    processingGap: documentsUnread > 0,
    documentsProvided,
    documentsRead,
    documentsUnread,
    openUnknowns,
    resolvedUnknowns,
    limitations,
    customerBlockers,
  };
}
