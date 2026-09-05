/**
 * Package C — pure path-step completion predicates (no DB).
 */

import { EVIDENCE_AUDIT_STATUS } from "@/lib/evidence/types";
import { isAccountTranscriptDoc, isNoticeDoc } from "@/lib/evidence/is-transcript";

export const REQUIRED_EVIDENCE_KINDS_DEFAULT = ["transcript", "notice"] as const;

export function uploadDocumentsSatisfied(
  docs: { docKind: string; documentType?: string | null; fileName?: string | null }[],
  requiredKinds: string[] = [...REQUIRED_EVIDENCE_KINDS_DEFAULT],
): boolean {
  if (docs.length === 0) return false;
  return requiredKinds.some((k) =>
    docs.some((d) => {
      if (d.docKind === k) return true;
      if (k === "transcript") return isAccountTranscriptDoc(d);
      if (k === "notice") return isNoticeDoc(d);
      return false;
    }),
  );
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
