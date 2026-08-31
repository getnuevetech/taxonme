import { DOCUMENT_FAMILIES, DOCUMENT_TYPES, type DocumentType } from "./types";

// Deterministic document classification. A tax document is never silently
// labelled "other": when nothing matches we say UNKNOWN_TAX_DOCUMENT so the
// evidence auditor can see that the type is genuinely undetermined.

export type DocumentClassification = {
  documentType: DocumentType;
  documentFamily: string;
  confidence: "high" | "medium" | "low";
  taxPeriods: string[];
};

type ClassifyInput = {
  fileName?: string;
  mimeType?: string;
  text?: string;
  docKind?: string;
};

const FAMILY_BY_TYPE: Record<string, string> = {
  [DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT]: DOCUMENT_FAMILIES.TRANSCRIPT,
  [DOCUMENT_TYPES.IRS_RETURN_TRANSCRIPT]: DOCUMENT_FAMILIES.TRANSCRIPT,
  [DOCUMENT_TYPES.IRS_RECORD_OF_ACCOUNT]: DOCUMENT_FAMILIES.TRANSCRIPT,
  [DOCUMENT_TYPES.IRS_WAGE_INCOME_TRANSCRIPT]: DOCUMENT_FAMILIES.TRANSCRIPT,
  [DOCUMENT_TYPES.IRS_NOTICE]: DOCUMENT_FAMILIES.CORRESPONDENCE,
  [DOCUMENT_TYPES.IRS_LETTER]: DOCUMENT_FAMILIES.CORRESPONDENCE,
  [DOCUMENT_TYPES.IRS_CORRESPONDENCE]: DOCUMENT_FAMILIES.CORRESPONDENCE,
  [DOCUMENT_TYPES.TAX_RETURN]: DOCUMENT_FAMILIES.RETURN,
  [DOCUMENT_TYPES.AMENDED_RETURN]: DOCUMENT_FAMILIES.RETURN,
  [DOCUMENT_TYPES.BUSINESS_RETURN]: DOCUMENT_FAMILIES.RETURN,
  [DOCUMENT_TYPES.PAYROLL_RETURN]: DOCUMENT_FAMILIES.RETURN,
  [DOCUMENT_TYPES.W2]: DOCUMENT_FAMILIES.INCOME_STATEMENT,
  [DOCUMENT_TYPES.FORM_1099]: DOCUMENT_FAMILIES.INCOME_STATEMENT,
  [DOCUMENT_TYPES.K1]: DOCUMENT_FAMILIES.INCOME_STATEMENT,
  [DOCUMENT_TYPES.PAYMENT_CONFIRMATION]: DOCUMENT_FAMILIES.PAYMENT,
  [DOCUMENT_TYPES.INSTALLMENT_AGREEMENT]: DOCUMENT_FAMILIES.PAYMENT,
  [DOCUMENT_TYPES.STATE_TAX_DOCUMENT]: DOCUMENT_FAMILIES.OTHER,
  [DOCUMENT_TYPES.UNKNOWN_TAX_DOCUMENT]: DOCUMENT_FAMILIES.OTHER,
};

const TEXT_RULES: { type: DocumentType; pattern: RegExp }[] = [
  { type: DOCUMENT_TYPES.IRS_RECORD_OF_ACCOUNT, pattern: /record\s+of\s+account/i },
  { type: DOCUMENT_TYPES.IRS_WAGE_INCOME_TRANSCRIPT, pattern: /wage\s+and\s+income\s+transcript/i },
  { type: DOCUMENT_TYPES.IRS_RETURN_TRANSCRIPT, pattern: /return\s+transcript/i },
  { type: DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT, pattern: /account[\s_-]*transcript|account\s+balance:/i },
  { type: DOCUMENT_TYPES.AMENDED_RETURN, pattern: /\b1040-?x\b|amended\s+u\.?s\.?\s+individual/i },
  { type: DOCUMENT_TYPES.PAYROLL_RETURN, pattern: /\bform\s*94[01]\b|employer'?s\s+quarterly\s+federal\s+tax/i },
  { type: DOCUMENT_TYPES.BUSINESS_RETURN, pattern: /\bform\s*11(20|65)\b|u\.?s\.?\s+corporation\s+income\s+tax\s+return/i },
  { type: DOCUMENT_TYPES.TAX_RETURN, pattern: /\bform\s*1040\b|u\.?s\.?\s+individual\s+income\s+tax\s+return/i },
  { type: DOCUMENT_TYPES.W2, pattern: /\bw-?2\b|wage\s+and\s+tax\s+statement/i },
  { type: DOCUMENT_TYPES.K1, pattern: /schedule\s+k-?1/i },
  { type: DOCUMENT_TYPES.FORM_1099, pattern: /\b1099(-[a-z]{1,4})?\b/i },
  { type: DOCUMENT_TYPES.INSTALLMENT_AGREEMENT, pattern: /installment\s+agreement|\bform\s*9465\b/i },
  { type: DOCUMENT_TYPES.PAYMENT_CONFIRMATION, pattern: /payment\s+confirmation|eftps|confirmation\s+number/i },
  { type: DOCUMENT_TYPES.IRS_NOTICE, pattern: /\b(CP|LT|LTR)\s?-?\d{2,4}[A-Z]?\b|notice\s+date/i },
  { type: DOCUMENT_TYPES.STATE_TAX_DOCUMENT, pattern: /department\s+of\s+revenue|state\s+of\s+[a-z]+\s+tax/i },
  { type: DOCUMENT_TYPES.IRS_LETTER, pattern: /internal\s+revenue\s+service/i },
];

// The customer's upload category is a hint, never the analytical type.
const DOC_KIND_HINTS: Record<string, DocumentType> = {
  transcript: DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT,
  notice: DOCUMENT_TYPES.IRS_NOTICE,
  "1040": DOCUMENT_TYPES.TAX_RETURN,
  w2: DOCUMENT_TYPES.W2,
  "1099": DOCUMENT_TYPES.FORM_1099,
};

function taxPeriodsFrom(text: string): string[] {
  const explicit = (text.match(/tax\s+(?:period|year)[^\n]{0,40}?(20\d{2})/gi) ?? [])
    .map((line) => line.match(/(20\d{2})/)?.[1] ?? "")
    .filter(Boolean);
  return Array.from(new Set(explicit));
}

export function classifyDocument(input: ClassifyInput): DocumentClassification {
  const text = input.text ?? "";
  const haystack = `${input.fileName ?? ""}\n${text}`;

  for (const rule of TEXT_RULES) {
    if (rule.pattern.test(haystack)) {
      return {
        documentType: rule.type,
        documentFamily: FAMILY_BY_TYPE[rule.type] ?? DOCUMENT_FAMILIES.OTHER,
        confidence: text ? "high" : "medium",
        taxPeriods: taxPeriodsFrom(haystack),
      };
    }
  }

  const hinted = DOC_KIND_HINTS[(input.docKind ?? "").toLowerCase()];
  if (hinted) {
    return {
      documentType: hinted,
      documentFamily: FAMILY_BY_TYPE[hinted] ?? DOCUMENT_FAMILIES.OTHER,
      confidence: "low",
      taxPeriods: taxPeriodsFrom(haystack),
    };
  }

  return {
    documentType: DOCUMENT_TYPES.UNKNOWN_TAX_DOCUMENT,
    documentFamily: DOCUMENT_FAMILIES.OTHER,
    confidence: "low",
    taxPeriods: taxPeriodsFrom(haystack),
  };
}
