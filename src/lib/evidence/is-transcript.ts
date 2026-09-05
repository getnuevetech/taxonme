/**
 * Package F — recognize IRS Account Transcript evidence beyond customer docKind.
 */

import { DOCUMENT_TYPES } from "@/lib/evidence/types";
import { looksLikeTranscript } from "@/lib/evidence/transcript";

export type TranscriptLikeDoc = {
  docKind?: string | null;
  documentType?: string | null;
  fileName?: string | null;
  text?: string | null;
};

const TRANSCRIPT_TYPES = new Set<string>([
  DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT,
  DOCUMENT_TYPES.IRS_RETURN_TRANSCRIPT,
  DOCUMENT_TYPES.IRS_RECORD_OF_ACCOUNT,
  DOCUMENT_TYPES.IRS_WAGE_INCOME_TRANSCRIPT,
]);

export function isAccountTranscriptDoc(doc: TranscriptLikeDoc): boolean {
  const type = String(doc.documentType ?? "");
  if (TRANSCRIPT_TYPES.has(type) || /TRANSCRIPT|RECORD_OF_ACCOUNT/i.test(type)) return true;
  if (String(doc.docKind ?? "").toLowerCase() === "transcript") return true;
  if (/transcript|record\s+of\s+account/i.test(String(doc.fileName ?? ""))) return true;
  if (doc.text && looksLikeTranscript(doc.text)) return true;
  return false;
}

export function isNoticeDoc(doc: TranscriptLikeDoc): boolean {
  const type = String(doc.documentType ?? "");
  if (type === DOCUMENT_TYPES.IRS_NOTICE || type === DOCUMENT_TYPES.IRS_LETTER || /NOTICE|LETTER|CORRESPONDENCE/i.test(type)) {
    return true;
  }
  if (String(doc.docKind ?? "").toLowerCase() === "notice") return true;
  if (/\b(cp|lt|ltr)\s?-?\d/i.test(String(doc.fileName ?? ""))) return true;
  return false;
}

/** Map analytical documentType to customer-facing docKind when kind is still "other". */
export function docKindFromDocumentType(documentType: string, currentKind: string): string {
  if (currentKind && currentKind !== "other" && currentKind !== "avatar") return currentKind;
  if (TRANSCRIPT_TYPES.has(documentType) || /TRANSCRIPT|RECORD_OF_ACCOUNT/i.test(documentType)) return "transcript";
  if (
    documentType === DOCUMENT_TYPES.IRS_NOTICE ||
    documentType === DOCUMENT_TYPES.IRS_LETTER ||
    /NOTICE|LETTER|CORRESPONDENCE/i.test(documentType)
  ) {
    return "notice";
  }
  if (documentType === DOCUMENT_TYPES.TAX_RETURN || documentType === DOCUMENT_TYPES.AMENDED_RETURN) return "1040";
  if (documentType === DOCUMENT_TYPES.W2) return "w2";
  if (documentType === DOCUMENT_TYPES.FORM_1099) return "1099";
  return currentKind || "other";
}
