/**
 * Phase E — approval gate (tax). Fail-closed BLOCKs refuse customer-facing approve.
 */

import { classifyDocument } from "@/lib/evidence/classify";
import { taxDocumentTypeLabel } from "@/lib/evidence/document-labels";
import { dedupeDocumentsByHash, ledgerFact, type FactLedger } from "@/lib/evidence/fact-ledger";
import {
  isCollectionsLevyLock,
  isCp2000Lock,
  matterTypeLockFromBrief,
  passesRecommendationLock,
  type MatterTypeLock,
} from "@/lib/matter-type-lock";
import { processDocumentsSkipReason } from "@/lib/matter-analysis-plan";

export type ApprovalGateSeverity = "BLOCK" | "WARNING";
export type ApprovalGateResultKind = "PASS" | "BLOCK" | "WARN";

export type ApprovalGateFinding = {
  rule_id: string;
  severity: ApprovalGateSeverity;
  reason: string;
};

export type ApprovalGateDocument = {
  id?: string | null;
  fileName: string;
  documentType?: string | null;
  docKind?: string | null;
  contentHash?: string | null;
  duplicateOfId?: string | null;
};

export type ApprovalGateInput = {
  lock?: MatterTypeLock | null;
  brief?: {
    primaryModule?: string | null;
    relatedModule?: string | null;
    doNotRecommendNewPathway?: boolean;
    lockOpenReliefOptions?: boolean;
    matterType?: string;
  } | null;
  documents?: ApprovalGateDocument[];
  factLedger?: FactLedger | null;
  customerText?: string;
  customerOutputStale?: boolean;
  documentCount?: number;
  openOptions?: boolean;
  planSkipReason?: string | null;
  assertsMaterialLegalMeaning?: boolean;
  legalIssuer?: string | null;
  logicalAnalysisId?: string | null;
  caseVersionId?: string | null;
  caseId?: string | null;
};

export type ApprovalGateAudit = {
  gate_result: ApprovalGateResultKind;
  rule_ids: string[];
  blocks: ApprovalGateFinding[];
  warnings: ApprovalGateFinding[];
  reasons: string[];
  logical_analysis_id: string | null;
  case_version_id: string | null;
  case_id: string | null;
  evaluated_at: string;
  override_by: string | null;
  override_time: string | null;
  override_reason: string | null;
  previous_gate_result: ApprovalGateResultKind | null;
};

export const APPROVAL_GATE_BLOCK_IDS = [
  "BLOCK-DOC-MISCLASS-NOTICE-AS-OTHER",
  "BLOCK-DOC-MISCLASS-TRANSCRIPT-AS-OTHER",
  "BLOCK-FACT-BALANCE-REPORTED-DESPITE-TRANSCRIPT",
  "BLOCK-LOCK-NEW-1040-IN-COLLECTIONS",
  "BLOCK-LOCK-OIC-BEFORE-CP2000-RESPONSE",
  "BLOCK-DEDUP-DUPLICATE-EVIDENCE-ROW",
  "BLOCK-PLAN-DOCS-SKIPPED-WHILE-USED",
  "BLOCK-STATE-STALE-DERIVED-OUTPUT",
  "BLOCK-AUTHORITY-UNSUPPORTED-LEGAL-INTERPRETATION",
] as const;

export const APPROVAL_GATE_WARN_IDS = [
  "WARN-UNKNOWN-TAX-YEAR",
  "WARN-UNKNOWN-BALANCE",
  "WARN-EVIDENCE-GAP-NOT-CONFLICT",
  "WARN-UNVERIFIED-CLAIM-NOT-CONFLICT",
] as const;

const ALLOWED_LEGAL_ISSUERS = new Set(["IRS", "STATE_DOR", "TAX_COURT"]);

function resolveDocType(doc: ApprovalGateDocument): string {
  if (doc.documentType) return doc.documentType;
  return classifyDocument({ fileName: doc.fileName, text: "", docKind: doc.docKind ?? undefined }).documentType;
}

function finding(rule_id: string, severity: ApprovalGateSeverity, reason: string): ApprovalGateFinding {
  return { rule_id, severity, reason };
}

export function evaluateApprovalGate(input: ApprovalGateInput): ApprovalGateAudit {
  const blocks: ApprovalGateFinding[] = [];
  const warnings: ApprovalGateFinding[] = [];
  const lock = input.lock ?? matterTypeLockFromBrief(input.brief);
  const docs = input.documents ?? [];

  for (const doc of docs) {
    const resolved = resolveDocType(doc);
    const label = taxDocumentTypeLabel(resolved);
    if (/\b(cp|lt)\s?-?\d/i.test(doc.fileName) && (resolved === "UNKNOWN_TAX_DOCUMENT" || resolved === "other")) {
      blocks.push(
        finding(
          "BLOCK-DOC-MISCLASS-NOTICE-AS-OTHER",
          "BLOCK",
          `Notice-shaped filename ${doc.fileName} classified as ${label}`,
        ),
      );
    }
    if (/transcript/i.test(doc.fileName) && (resolved === "UNKNOWN_TAX_DOCUMENT" || /other/i.test(resolved))) {
      blocks.push(
        finding(
          "BLOCK-DOC-MISCLASS-TRANSCRIPT-AS-OTHER",
          "BLOCK",
          `Transcript-shaped filename ${doc.fileName} classified as ${label}`,
        ),
      );
    }
  }

  const ledger = input.factLedger;
  const balance = ledgerFact(ledger, "ACCOUNT_BALANCE");
  const hasTranscript = docs.some((d) => resolveDocType(d) === "IRS_ACCOUNT_TRANSCRIPT");
  if (balance?.status === "REPORTED" && hasTranscript) {
    blocks.push(
      finding(
        "BLOCK-FACT-BALANCE-REPORTED-DESPITE-TRANSCRIPT",
        "BLOCK",
        "Account balance still REPORTED despite transcript on file",
      ),
    );
  }

  const customerText = input.customerText ?? "";
  if (isCollectionsLevyLock(lock) && !passesRecommendationLock(customerText, lock)) {
    blocks.push(
      finding(
        "BLOCK-LOCK-NEW-1040-IN-COLLECTIONS",
        "BLOCK",
        "Customer copy recommends a competing new-return pathway under a collections lock",
      ),
    );
  }
  if (isCp2000Lock(lock) && /start with an offer in compromise before responding to the CP2000/i.test(customerText)) {
    blocks.push(
      finding(
        "BLOCK-LOCK-OIC-BEFORE-CP2000-RESPONSE",
        "BLOCK",
        "Customer copy jumps to OIC before CP2000 response under CP2000 lock",
      ),
    );
  }

  const deduped = dedupeDocumentsByHash(docs);
  if (docs.filter((d) => !d.duplicateOfId).length > deduped.length) {
    blocks.push(
      finding("BLOCK-DEDUP-DUPLICATE-EVIDENCE-ROW", "BLOCK", "Duplicate evidence rows would appear to the customer"),
    );
  }

  const skip =
    input.planSkipReason ??
    processDocumentsSkipReason({
      openOptions: Boolean(input.openOptions),
      documentCount: input.documentCount ?? docs.length,
    });
  if ((input.documentCount ?? docs.length) > 0 && /options review|processing not needed/i.test(skip)) {
    blocks.push(
      finding(
        "BLOCK-PLAN-DOCS-SKIPPED-WHILE-USED",
        "BLOCK",
        "Analysis plan claims document processing is not needed while documents are present",
      ),
    );
  }

  if (input.customerOutputStale) {
    blocks.push(
      finding("BLOCK-STATE-STALE-DERIVED-OUTPUT", "BLOCK", "Customer output is stale after evidence change"),
    );
  }

  if (input.assertsMaterialLegalMeaning) {
    const issuer = input.legalIssuer ?? "";
    if (!ALLOWED_LEGAL_ISSUERS.has(issuer)) {
      blocks.push(
        finding(
          "BLOCK-AUTHORITY-UNSUPPORTED-LEGAL-INTERPRETATION",
          "BLOCK",
          "Material legal meaning asserted without IRS/state/tax-court authority",
        ),
      );
    }
  }

  if (ledgerFact(ledger, "TAX_YEAR")?.status === "UNKNOWN") {
    warnings.push(finding("WARN-UNKNOWN-TAX-YEAR", "WARNING", "Tax year is unknown"));
  }
  if (ledgerFact(ledger, "ACCOUNT_BALANCE")?.status === "UNKNOWN") {
    warnings.push(finding("WARN-UNKNOWN-BALANCE", "WARNING", "Account balance is unknown"));
  }
  for (const gap of ledger?.evidence_gaps ?? []) {
    warnings.push(
      finding("WARN-EVIDENCE-GAP-NOT-CONFLICT", "WARNING", `Evidence gap: ${JSON.stringify(gap)}`),
    );
  }
  for (const claim of ledger?.unverified_claims ?? []) {
    warnings.push(
      finding("WARN-UNVERIFIED-CLAIM-NOT-CONFLICT", "WARNING", `Unverified claim: ${JSON.stringify(claim)}`),
    );
  }

  const gate_result: ApprovalGateResultKind = blocks.length ? "BLOCK" : warnings.length ? "WARN" : "PASS";
  return {
    gate_result,
    rule_ids: [...blocks, ...warnings].map((f) => f.rule_id),
    blocks,
    warnings,
    reasons: [...blocks, ...warnings].map((f) => f.reason),
    logical_analysis_id: input.logicalAnalysisId ?? null,
    case_version_id: input.caseVersionId ?? null,
    case_id: input.caseId ?? null,
    evaluated_at: new Date().toISOString(),
    override_by: null,
    override_time: null,
    override_reason: null,
    previous_gate_result: null,
  };
}

export function withGateOverride(
  audit: ApprovalGateAudit,
  opts: { by: string; reason: string },
): ApprovalGateAudit {
  return {
    ...audit,
    previous_gate_result: audit.gate_result,
    gate_result: "PASS",
    override_by: opts.by,
    override_time: new Date().toISOString(),
    override_reason: opts.reason,
  };
}

export function selectApprovedPresentation<T>(
  presentation: T | null | undefined,
  audit: ApprovalGateAudit,
): T | null {
  if (!presentation) return null;
  if (audit.gate_result === "BLOCK") return null;
  return presentation;
}
