import { FACT_KEYS, PROVENANCE, type EvidenceEventInput, type EvidenceFactInput } from "./types";
import { parseTranscript } from "./transcript";

// Deterministic evidence compilation: turns readable document text into
// normalized facts and account events. Nothing here interprets tax law — it
// only records what the document says, with provenance and timing preserved.

export function parseDocumentDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const us = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (us) {
    const parsed = new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function transcriptPeriod(periods: string[]): string {
  return periods.length ? periods[periods.length - 1] : "";
}

type DocumentInput = {
  documentId: string;
  documentType: string;
  text: string;
  taxPeriods?: string[];
};

export function compileDocumentFacts(input: DocumentInput): EvidenceFactInput[] {
  const facts: EvidenceFactInput[] = [];
  const text = input.text ?? "";
  if (!text.trim()) return facts;

  const periods = input.taxPeriods ?? [];
  const transcript = parseTranscript(text);
  const period = transcriptPeriod(transcript.taxPeriods.length ? transcript.taxPeriods : periods);
  const base: Pick<EvidenceFactInput, "documentId" | "sourceId" | "provenance"> = {
    documentId: input.documentId,
    sourceId: input.documentId,
    provenance: PROVENANCE.DOCUMENT_EXTRACTED,
  };

  if (transcript.transactions.length > 0 || transcript.accountBalance !== null) {
    facts.push({
      ...base,
      factKey: FACT_KEYS.TRANSCRIPT_ON_FILE,
      factType: "status",
      valueText: input.documentType,
      taxPeriod: period,
    });
  }

  if (transcript.accountBalance !== null) {
    facts.push({
      ...base,
      factKey: FACT_KEYS.ACCOUNT_BALANCE,
      factType: "amount",
      valueNumber: transcript.accountBalance,
      valueText: String(transcript.accountBalance),
      unit: "USD",
      taxPeriod: period,
      effectiveDate: parseDocumentDate(transcript.accountBalanceAsOf),
      sourceField: "ACCOUNT BALANCE",
    });
  }

  if (transcript.refundIssued) {
    facts.push({
      ...base,
      factKey: FACT_KEYS.REFUND_ISSUED,
      factType: "amount",
      valueNumber: Math.abs(transcript.refundIssued.amount),
      valueText: String(Math.abs(transcript.refundIssued.amount)),
      unit: "USD",
      taxPeriod: period,
      effectiveDate: parseDocumentDate(transcript.refundIssued.date),
      sourceField: `TC ${transcript.refundIssued.code}`,
    });
  }

  for (const offset of transcript.offsets) {
    facts.push({
      ...base,
      factKey: FACT_KEYS.CREDIT_TRANSFER,
      factType: "amount",
      valueNumber: Math.abs(offset.amount),
      valueText: offset.description,
      unit: "USD",
      taxPeriod: period,
      effectiveDate: parseDocumentDate(offset.date),
      sourceField: `TC ${offset.code}`,
    });
  }

  for (const penalty of transcript.penalties) {
    facts.push({
      ...base,
      factKey: FACT_KEYS.PENALTY,
      factType: "amount",
      valueNumber: Math.abs(penalty.amount),
      valueText: penalty.description,
      unit: "USD",
      taxPeriod: period,
      effectiveDate: parseDocumentDate(penalty.date),
      sourceField: `TC ${penalty.code}`,
    });
  }

  if (transcript.hold) {
    facts.push({ ...base, factKey: FACT_KEYS.ACCOUNT_HOLD, factType: "status", valueText: "hold present", taxPeriod: period });
  }

  const noticeCode = text.toUpperCase().match(/\b(CP|LT|LTR)\s?-?\d{2,4}[A-Z]?\b/)?.[0]?.replace(/\s|-/g, "");
  if (noticeCode) {
    facts.push({ ...base, factKey: FACT_KEYS.NOTICE_CODE, factType: "identifier", valueText: noticeCode, taxPeriod: period });
  }

  const deadline = text.match(/(?:respond|reply|pay)[^\n]{0,40}?by[^\n]{0,20}?([A-Z][a-z]{2,9}\.?\s+\d{1,2},\s*\d{4}|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})/);
  if (deadline) {
    facts.push({
      ...base,
      factKey: FACT_KEYS.NOTICE_DEADLINE,
      factType: "date",
      valueText: deadline[1],
      effectiveDate: parseDocumentDate(deadline[1]),
      taxPeriod: period,
    });
  }

  for (const taxPeriod of new Set([...transcript.taxPeriods, ...periods])) {
    facts.push({ ...base, factKey: FACT_KEYS.TAX_PERIOD, factType: "identifier", valueText: taxPeriod, taxPeriod });
  }

  return facts;
}

export function compileDocumentEvents(input: DocumentInput): EvidenceEventInput[] {
  const text = input.text ?? "";
  if (!text.trim()) return [];
  const transcript = parseTranscript(text);
  const period = transcriptPeriod(transcript.taxPeriods.length ? transcript.taxPeriods : (input.taxPeriods ?? []));
  return transcript.transactions.map((tx) => ({
    taxPeriod: period,
    eventType: eventTypeForCode(tx.code),
    transactionCode: tx.code,
    description: tx.description,
    eventDate: parseDocumentDate(tx.date),
    amount: tx.amount,
    balanceEffect: tx.amount === 0 ? "none" : tx.amount < 0 ? "decrease" : "increase",
    provenance: PROVENANCE.DOCUMENT_EXTRACTED,
  }));
}

// Transaction codes carry meaning, but unknown codes must survive as events
// rather than be discarded.
function eventTypeForCode(code: string): string {
  switch (code) {
    case "846":
      return "REFUND_ISSUED";
    case "826":
      return "CREDIT_TRANSFERRED_OUT";
    case "706":
      return "CREDIT_TRANSFERRED_IN";
    case "570":
      return "ACCOUNT_HOLD";
    case "571":
      return "ACCOUNT_HOLD_RELEASED";
    case "276":
    case "196":
    case "166":
      return "PENALTY_OR_INTEREST_ASSESSED";
    case "670":
      return "PAYMENT_RECEIVED";
    case "806":
      return "WITHHOLDING_CREDIT";
    case "150":
      return "RETURN_FILED";
    default:
      return "UNCLASSIFIED_EVENT";
  }
}

// Facts the customer told us. Useful context, but never strong enough to close
// an unknown that a document should answer.
export function compileNarrativeFacts(situation: string, goal: string): EvidenceFactInput[] {
  const facts: EvidenceFactInput[] = [];
  const narrative = `${situation}\n${goal}`;
  const years = Array.from(new Set(narrative.match(/\b20\d{2}\b/g) ?? []));
  for (const year of years) {
    facts.push({ factKey: FACT_KEYS.TAX_PERIOD, factType: "identifier", valueText: year, taxPeriod: year, provenance: PROVENANCE.USER_REPORTED });
  }
  const noticeCode = narrative.toUpperCase().match(/\b(CP|LT|LTR)\s?-?\d{2,4}[A-Z]?\b/)?.[0]?.replace(/\s|-/g, "");
  if (noticeCode) {
    facts.push({ factKey: FACT_KEYS.NOTICE_CODE, factType: "identifier", valueText: noticeCode, provenance: PROVENANCE.USER_REPORTED });
  }
  return facts;
}
