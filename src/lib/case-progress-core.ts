/**
 * Package C — pure path-step completion predicates (no DB).
 */

import { EVIDENCE_AUDIT_STATUS } from "@/lib/evidence/types";

export const REQUIRED_EVIDENCE_KINDS_DEFAULT = ["transcript", "notice"] as const;

export function uploadDocumentsSatisfied(
  docs: { docKind: string; documentType?: string | null }[],
  requiredKinds: string[] = [...REQUIRED_EVIDENCE_KINDS_DEFAULT],
): boolean {
  const kinds = new Set(docs.map((d) => d.docKind).filter((k) => k && k !== "avatar"));
  if (kinds.size === 0) return false;
  // Complete only when at least one required evidence kind is present.
  return requiredKinds.some((k) => kinds.has(k));
}

export function isEvidenceAuditPassing(status: string | null | undefined): boolean {
  if (!status) return false;
  return (
    status === EVIDENCE_AUDIT_STATUS.EVIDENCE_READY ||
    status === EVIDENCE_AUDIT_STATUS.EVIDENCE_READY_WITH_LIMITATIONS ||
    status === "EVIDENCE_READY" ||
    status === "EVIDENCE_READY_WITH_LIMITATIONS"
  );
}

export function reviewAnalysisSatisfied(input: {
  hasRunAfterNewestDoc: boolean;
  auditStatus: string | null;
}): boolean {
  return input.hasRunAfterNewestDoc && isEvidenceAuditPassing(input.auditStatus);
}

export const VERIFIABLE_ACTION_COPY: Record<string, string> = {
  UPLOAD_DOCUMENTS: "Completes when required IRS evidence (transcript or notice) is on file — not just any upload",
  GET_TRANSCRIPT: "Completes when an IRS transcript is uploaded to your case",
  GET_ACCOUNT_TRANSCRIPT: "Completes when an IRS transcript is uploaded to your case",
  REVIEW_ANALYSIS: "Completes when analysis was re-run after documents and the evidence audit passes",
  RERUN_ANALYSIS: "Completes when analysis was re-run after documents and the evidence audit passes",
  DRAFT_LETTER: "Completes when a response letter has been drafted (draft ≠ IRS submission)",
  COMPLETE_FORM_9465: "Completes when the Form 9465 wizard is finished",
  ADD_DEADLINE: "Completes when a deadline is tracked for this case",
};
