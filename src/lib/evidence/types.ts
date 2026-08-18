// v3.2 evidence layer vocabulary. Kept dependency-free so both server code and
// the acceptance scripts can use it.

export const PROVENANCE = {
  USER_REPORTED: "USER_REPORTED",
  DOCUMENT_EXTRACTED: "DOCUMENT_EXTRACTED",
  DOCUMENT_VERIFIED: "DOCUMENT_VERIFIED",
  IRS_AUTHORITY: "IRS_AUTHORITY",
  SYSTEM_CALCULATED: "SYSTEM_CALCULATED",
  PROFESSIONAL_CONFIRMED: "PROFESSIONAL_CONFIRMED",
  MODEL_INFERENCE: "MODEL_INFERENCE",
  LEGACY_MODEL_INFERENCE: "LEGACY_MODEL_INFERENCE",
} as const;

export type Provenance = (typeof PROVENANCE)[keyof typeof PROVENANCE];

// Evidence strong enough to answer a question on the customer's behalf: it came
// from a document or from our own arithmetic, not from the customer's memory or
// a model's guess.
const EVIDENTIARY_PROVENANCE = new Set<string>([
  PROVENANCE.DOCUMENT_EXTRACTED,
  PROVENANCE.DOCUMENT_VERIFIED,
  PROVENANCE.SYSTEM_CALCULATED,
  PROVENANCE.PROFESSIONAL_CONFIRMED,
  PROVENANCE.IRS_AUTHORITY,
]);

export function isEvidentiaryProvenance(provenance: string): boolean {
  return EVIDENTIARY_PROVENANCE.has(provenance);
}

export const DOCUMENT_TYPES = {
  IRS_ACCOUNT_TRANSCRIPT: "IRS_ACCOUNT_TRANSCRIPT",
  IRS_RETURN_TRANSCRIPT: "IRS_RETURN_TRANSCRIPT",
  IRS_RECORD_OF_ACCOUNT: "IRS_RECORD_OF_ACCOUNT",
  IRS_WAGE_INCOME_TRANSCRIPT: "IRS_WAGE_INCOME_TRANSCRIPT",
  IRS_NOTICE: "IRS_NOTICE",
  IRS_LETTER: "IRS_LETTER",
  TAX_RETURN: "TAX_RETURN",
  AMENDED_RETURN: "AMENDED_RETURN",
  W2: "W2",
  FORM_1099: "1099",
  K1: "K1",
  PAYMENT_CONFIRMATION: "PAYMENT_CONFIRMATION",
  INSTALLMENT_AGREEMENT: "INSTALLMENT_AGREEMENT",
  IRS_CORRESPONDENCE: "IRS_CORRESPONDENCE",
  BUSINESS_RETURN: "BUSINESS_RETURN",
  PAYROLL_RETURN: "PAYROLL_RETURN",
  STATE_TAX_DOCUMENT: "STATE_TAX_DOCUMENT",
  UNKNOWN_TAX_DOCUMENT: "UNKNOWN_TAX_DOCUMENT",
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const DOCUMENT_FAMILIES = {
  TRANSCRIPT: "TRANSCRIPT",
  CORRESPONDENCE: "CORRESPONDENCE",
  RETURN: "RETURN",
  INCOME_STATEMENT: "INCOME_STATEMENT",
  PAYMENT: "PAYMENT",
  OTHER: "OTHER",
} as const;

export const PROCESSING_STATUS = {
  PENDING: "pending",
  COMPLETE: "complete",
  PARTIAL: "partial",
  FAILED: "failed",
} as const;

export const EVIDENCE_AUDIT_STATUS = {
  EVIDENCE_READY: "EVIDENCE_READY",
  EVIDENCE_READY_WITH_LIMITATIONS: "EVIDENCE_READY_WITH_LIMITATIONS",
  EVIDENCE_PROCESSING_INCOMPLETE: "EVIDENCE_PROCESSING_INCOMPLETE",
  HUMAN_DOCUMENT_REVIEW_REQUIRED: "HUMAN_DOCUMENT_REVIEW_REQUIRED",
} as const;

// Normalized fact identifiers. New keys may be added freely; nothing downstream
// may assume this list is exhaustive.
export const FACT_KEYS = {
  ACCOUNT_BALANCE: "account_balance",
  BALANCE_REPORTED: "balance_reported",
  REFUND_ISSUED: "refund_issued",
  REFUND_EXPECTED: "refund_expected",
  TAX_PERIOD: "tax_period",
  NOTICE_CODE: "notice_code",
  NOTICE_DEADLINE: "notice_deadline",
  CREDIT_TRANSFER: "credit_transfer",
  PAYMENT: "payment",
  PENALTY: "penalty",
  ACCOUNT_HOLD: "account_hold",
  TRANSCRIPT_ON_FILE: "transcript_on_file",
  UNFILED_YEARS: "unfiled_years",
} as const;

export type EvidenceFactInput = {
  factKey: string;
  subject?: string;
  factType?: "amount" | "date" | "identifier" | "status" | "narrative";
  valueText?: string;
  valueNumber?: number | null;
  unit?: string;
  taxPeriod?: string;
  effectiveDate?: Date | null;
  recordDate?: Date | null;
  provenance: Provenance;
  sourceId?: string;
  sourcePage?: number | null;
  sourceField?: string;
  documentId?: string | null;
  metadata?: Record<string, unknown>;
};

export type EvidenceEventInput = {
  taxPeriod?: string;
  eventType: string;
  transactionCode?: string;
  description?: string;
  eventDate?: Date | null;
  amount?: number | null;
  balanceEffect?: "increase" | "decrease" | "none" | "unknown";
  provenance?: Provenance;
};
