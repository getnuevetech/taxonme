import { DOCUMENT_TYPES, type DocumentType } from "./types";

export type AuthorityRank =
  | "IRS_GOVERNMENT_DOCUMENT"
  | "STATE_TAX_AUTHORITY"
  | "FILED_RETURN_OR_ACKNOWLEDGMENT"
  | "INCOME_STATEMENT"
  | "CUSTOMER_UPLOADED_SUPPORTING_DOCUMENT"
  | "CUSTOMER_STATEMENT"
  | "AI_INFERENCE";

export type SourceChannel = "CUSTOMER_UPLOAD" | "STAFF_UPLOAD" | "SYSTEM_IMPORT" | "USER_STATEMENT";

export type Issuer = "IRS" | "STATE_DOR" | "TAX_COURT" | "CUSTOMER" | "UNKNOWN";

/** Authority follows issuer + document type, not upload channel. */
export function authorityForDocumentType(documentType: string | null | undefined): {
  issuer: Issuer;
  authority_rank: AuthorityRank;
} {
  const type = String(documentType ?? "");
  if (
    type === DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT ||
    type === DOCUMENT_TYPES.IRS_RETURN_TRANSCRIPT ||
    type === DOCUMENT_TYPES.IRS_RECORD_OF_ACCOUNT ||
    type === DOCUMENT_TYPES.IRS_WAGE_INCOME_TRANSCRIPT ||
    type === DOCUMENT_TYPES.IRS_NOTICE ||
    type === DOCUMENT_TYPES.IRS_LETTER ||
    type === DOCUMENT_TYPES.IRS_CORRESPONDENCE
  ) {
    return { issuer: "IRS", authority_rank: "IRS_GOVERNMENT_DOCUMENT" };
  }
  if (type === DOCUMENT_TYPES.STATE_TAX_DOCUMENT) {
    return { issuer: "STATE_DOR", authority_rank: "STATE_TAX_AUTHORITY" };
  }
  if (
    type === DOCUMENT_TYPES.TAX_RETURN ||
    type === DOCUMENT_TYPES.AMENDED_RETURN ||
    type === DOCUMENT_TYPES.BUSINESS_RETURN ||
    type === DOCUMENT_TYPES.PAYROLL_RETURN ||
    type === DOCUMENT_TYPES.INSTALLMENT_AGREEMENT ||
    type === DOCUMENT_TYPES.PAYMENT_CONFIRMATION
  ) {
    return { issuer: "IRS", authority_rank: "FILED_RETURN_OR_ACKNOWLEDGMENT" };
  }
  if (type === DOCUMENT_TYPES.W2 || type === DOCUMENT_TYPES.FORM_1099 || type === DOCUMENT_TYPES.K1) {
    return { issuer: "UNKNOWN", authority_rank: "INCOME_STATEMENT" };
  }
  return { issuer: "UNKNOWN", authority_rank: "CUSTOMER_UPLOADED_SUPPORTING_DOCUMENT" };
}

export function formatContentHash(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return value.startsWith("sha256:") ? value : `sha256:${value}`;
}

export function buildDocumentFactSource(input: {
  documentId: string;
  contentHash?: string | null;
  documentType?: string | null;
  extractedField?: string;
  sourcePage?: number | null;
  sourceChannel?: SourceChannel;
}): Record<string, unknown> {
  const auth = authorityForDocumentType(input.documentType);
  return {
    source_type: "DOCUMENT",
    document_id: input.documentId,
    content_hash: formatContentHash(input.contentHash),
    document_type: input.documentType ?? "UNKNOWN_TAX_DOCUMENT",
    extracted_field: input.extractedField ?? "document_type",
    source_page: input.sourcePage ?? 1,
    source_channel: input.sourceChannel ?? "CUSTOMER_UPLOAD",
    issuer: auth.issuer,
    authority_rank: auth.authority_rank,
  };
}

export function isIrsGovernmentType(documentType: string | null | undefined): boolean {
  return authorityForDocumentType(documentType).authority_rank === "IRS_GOVERNMENT_DOCUMENT";
}

export type { DocumentType };
