/**
 * Package D — apply V5.1 approval gate to customer-facing analysis outputs.
 * Fail closed on BLOCK: no presentation / resolution path; sparse evidence only.
 */

import {
  evaluateApprovalGate,
  selectApprovedPresentation,
  type ApprovalGateAudit,
  type ApprovalGateDocument,
  type ApprovalGateInput,
} from "@/lib/approval-gate";
import type { FactLedger } from "@/lib/evidence/fact-ledger";
import type { PathStepDraft } from "@/lib/path-from-analysis";

export type CustomerIssueDraft = Record<string, unknown>;

export function customerFacingTextFromOutputs(opts: {
  presentation?: Record<string, unknown> | null;
  issues?: CustomerIssueDraft[];
  pathSteps?: PathStepDraft[];
}): string {
  const parts: string[] = [];
  if (opts.presentation) {
    for (const key of [
      "headline",
      "summary",
      "finding_card",
      "next_step",
      "path_steps",
      "what_we_found",
      "consultant_recommended",
    ]) {
      const v = opts.presentation[key];
      if (v != null && v !== "") parts.push(typeof v === "string" ? v : JSON.stringify(v));
    }
  }
  for (const issue of opts.issues ?? []) {
    parts.push(
      [issue.title, issue.next_action, issue.our_conclusion, issue.alternative_action, issue.irs_basis]
        .map((x) => (x == null ? "" : String(x)))
        .filter(Boolean)
        .join(" "),
    );
  }
  for (const step of opts.pathSteps ?? []) {
    parts.push([step.title, step.description, step.action_key].filter(Boolean).join(" "));
  }
  return parts.join("\n");
}

/** Infer a matter brief (for locks) from narrative + document filenames. */
export function matterBriefFromNarrative(text: string): ApprovalGateInput["brief"] {
  if (/\b(levy|lt\s?-?11|intent\s+to\s+levy|final\s+notice.*levy)\b/i.test(text)) {
    return {
      primaryModule: "collection_levy",
      doNotRecommendNewPathway: true,
      matterType: "collection levy",
    };
  }
  if (/\bcp\s?-?2000\b/i.test(text)) {
    return {
      primaryModule: "cp2000_underreporter",
      doNotRecommendNewPathway: true,
      matterType: "CP2000 underreporter",
    };
  }
  return null;
}

/** Sparse presentation stored when the gate BLOCKs — UI must not show blocked AI copy. */
export function blockedCustomerPresentation(audit: ApprovalGateAudit): Record<string, unknown> {
  return {
    schema: "approval_gate_blocked",
    approval_gate: {
      gate_result: audit.gate_result,
      rule_ids: audit.rule_ids,
      reasons: audit.reasons,
    },
    issues: [],
    path_steps: [],
    what_we_found: [
      "Analysis is held for review — TaxOnMe will not show resolution recommendations until the approval gate passes.",
    ],
    what_is_still_unclear: [
      "Whether the blocked recommendation can be corrected with evidence or staff override",
    ],
    finding_card: null,
    next_step: {
      title: "Add IRS account records",
      detail: "Upload an Account Transcript or IRS notice so analysis can proceed on evidence, not blocked advice.",
    },
  };
}

export type FailClosedResult<TPresentation, TIssue, TPath> = {
  presentation: TPresentation | null;
  issues: TIssue[];
  pathSteps: TPath[];
  blocked: boolean;
  audit: ApprovalGateAudit;
  /** Presentation JSON to persist (blocked marker or approved presentation). */
  presentationToStore: Record<string, unknown> | null;
};

/**
 * Evaluate the gate and fail closed: BLOCK clears presentation / resolution path
 * and substitutes safe issues + thin evidence path steps.
 */
export function applyApprovalGateFailClosed<
  TPresentation extends Record<string, unknown>,
  TIssue extends CustomerIssueDraft,
  TPath extends PathStepDraft,
>(opts: {
  gateInput: ApprovalGateInput;
  presentation: TPresentation | null;
  issues: TIssue[];
  pathSteps: TPath[];
  thinPathSteps: TPath[];
  safeIssues: TIssue[];
}): FailClosedResult<TPresentation, TIssue, TPath> {
  const audit = evaluateApprovalGate(opts.gateInput);
  const approved = selectApprovedPresentation(opts.presentation, audit);
  if (audit.gate_result === "BLOCK") {
    return {
      presentation: null,
      issues: opts.safeIssues,
      pathSteps: opts.thinPathSteps,
      blocked: true,
      audit,
      presentationToStore: blockedCustomerPresentation(audit),
    };
  }
  return {
    presentation: approved,
    issues: opts.issues,
    pathSteps: opts.pathSteps,
    blocked: false,
    audit,
    presentationToStore: approved,
  };
}

export function approvalDocsFromCaseDocs(
  docs: {
    id?: string | null;
    fileName: string;
    documentType?: string | null;
    docKind?: string | null;
    contentHash?: string | null;
    duplicateOfId?: string | null;
  }[],
): ApprovalGateDocument[] {
  return docs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    documentType: d.documentType,
    docKind: d.docKind,
    contentHash: d.contentHash || null,
    duplicateOfId: d.duplicateOfId ?? null,
  }));
}

export function buildOrchestratorGateInput(opts: {
  caseId: string;
  analysisVersionId: string;
  situation: string;
  goal: string;
  documents: ApprovalGateDocument[];
  factLedger?: FactLedger | null;
  customerText: string;
  customerOutputStale?: boolean;
  openOptions?: boolean;
  planSkipReason?: string | null;
  assertsMaterialLegalMeaning?: boolean;
  legalIssuer?: string | null;
}): ApprovalGateInput {
  const narrative = `${opts.situation}\n${opts.goal}\n${opts.documents.map((d) => d.fileName).join(" ")}`;
  return {
    brief: matterBriefFromNarrative(narrative),
    documents: opts.documents,
    factLedger: opts.factLedger ?? null,
    customerText: opts.customerText,
    customerOutputStale: opts.customerOutputStale ?? false,
    documentCount: opts.documents.length,
    openOptions: opts.openOptions,
    planSkipReason: opts.planSkipReason,
    assertsMaterialLegalMeaning: opts.assertsMaterialLegalMeaning,
    legalIssuer: opts.legalIssuer,
    logicalAnalysisId: opts.analysisVersionId,
    caseVersionId: opts.analysisVersionId,
    caseId: opts.caseId,
  };
}
