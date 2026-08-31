import { DOCUMENT_TYPES } from "./types";

const LABELS: Record<string, string> = {
  [DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT]: "IRS Account Transcript",
  [DOCUMENT_TYPES.IRS_RETURN_TRANSCRIPT]: "IRS Return Transcript",
  [DOCUMENT_TYPES.IRS_RECORD_OF_ACCOUNT]: "IRS Record of Account",
  [DOCUMENT_TYPES.IRS_WAGE_INCOME_TRANSCRIPT]: "Wage & Income Transcript",
  [DOCUMENT_TYPES.IRS_NOTICE]: "IRS Notice",
  [DOCUMENT_TYPES.IRS_LETTER]: "IRS Letter",
  [DOCUMENT_TYPES.IRS_CORRESPONDENCE]: "IRS Correspondence",
  [DOCUMENT_TYPES.TAX_RETURN]: "Tax Return",
  [DOCUMENT_TYPES.AMENDED_RETURN]: "Amended Return",
  [DOCUMENT_TYPES.W2]: "Form W-2",
  [DOCUMENT_TYPES.FORM_1099]: "Form 1099",
  [DOCUMENT_TYPES.K1]: "Schedule K-1",
  [DOCUMENT_TYPES.PAYMENT_CONFIRMATION]: "Payment Confirmation",
  [DOCUMENT_TYPES.INSTALLMENT_AGREEMENT]: "Installment Agreement",
  [DOCUMENT_TYPES.STATE_TAX_DOCUMENT]: "State Tax Document",
  [DOCUMENT_TYPES.UNKNOWN_TAX_DOCUMENT]: "Unknown Tax Document",
  [DOCUMENT_TYPES.BUSINESS_RETURN]: "Business Return",
  [DOCUMENT_TYPES.PAYROLL_RETURN]: "Payroll Return",
};

export function taxDocumentTypeLabel(documentType: string | null | undefined): string {
  const key = String(documentType ?? "");
  return LABELS[key] ?? "Unknown Tax Document";
}
