import { DOCUMENT_TYPES } from "./types";
import { buildDocumentFactSource } from "./authority";

export type LedgerFactStatus = "VERIFIED" | "REPORTED" | "UNKNOWN";

export type LedgerClaimKind = "CONFLICT" | "UNVERIFIED_CLAIM" | "EVIDENCE_GAP";

export type LedgerFact = {
  fact_id: string;
  status: LedgerFactStatus;
  value: unknown;
  sources: Record<string, unknown>[];
  kind?: LedgerClaimKind;
  blocks_goal_progress?: boolean;
  note?: string;
  promotion_on?: { when_evidence: string; becomes: LedgerFactStatus };
};

export type LedgerPosture = {
  posture_id: string;
  value: string;
  supersedes: string | null;
  superseded_by: string | null;
};

export type LedgerTimelineEvent = {
  event_id: string;
  fact_id: string;
  status?: string;
  superseded_by: null;
};

export type FactLedger = {
  version: 1;
  facts: LedgerFact[];
  conflicts: unknown[];
  unverified_claims: Record<string, unknown>[];
  evidence_gaps: Record<string, unknown>[];
  event_timeline: LedgerTimelineEvent[];
  current_posture: LedgerPosture | null;
  built_at: string;
};

export type FactLedgerDocument = {
  id: string;
  fileName?: string | null;
  documentType?: string | null;
  contentHash?: string | null;
  text?: string | null;
};

export type FactLedgerInput = {
  situation?: string | null;
  goal?: string | null;
  clarifyText?: string | null;
  documents?: FactLedgerDocument[];
};

const BALANCE_RE =
  /\b(?:owe|balance(?:\s+due)?|account\s+balance)\b[^$]{0,40}\$?\s*([\d,]+\.?\d*)/i;
const TAX_YEAR_RE = /\b(?:tax\s+year|for)\s+(20\d{2})\b/i;
const CP2000_RE = /\bcp\s?-?2000\b/i;
const LEVY_RE = /\b(levy|lt\s?-?11|final\s+notice|intent\s+to\s+levy)\b/i;
const CANT_PAY_RE = /\b(can'?t pay|cannot pay|payment plan|installment)\b/i;

function hasType(docs: FactLedgerDocument[], type: string): FactLedgerDocument | undefined {
  return docs.find((doc) => doc.documentType === type);
}

function narrative(input: FactLedgerInput): string {
  return [input.situation, input.goal, input.clarifyText].map((v) => String(v ?? "")).join("\n");
}

function sourceForDoc(doc: FactLedgerDocument, extractedField: string): Record<string, unknown> {
  return buildDocumentFactSource({
    documentId: doc.id,
    contentHash: doc.contentHash,
    documentType: doc.documentType,
    extractedField,
  });
}

function userStatementSource(): Record<string, unknown> {
  return {
    source_type: "USER_STATEMENT",
    source_channel: "USER_STATEMENT",
    issuer: "CUSTOMER",
    authority_rank: "CUSTOMER_STATEMENT",
  };
}

function parseBalanceFromText(text: string): number | null {
  const m = text.match(/ACCOUNT\s+BALANCE:\s*([\d,]+\.?\d*)/i) || text.match(BALANCE_RE);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Derive the material fact ledger for a tax agency matter.
 * REPORTED → VERIFIED promotion is distinct from resolving UNKNOWN gaps.
 */
export function buildFactLedger(input: FactLedgerInput = {}): FactLedger {
  const docs = input.documents ?? [];
  const text = narrative(input);
  const facts: LedgerFact[] = [];
  const unverified_claims: Record<string, unknown>[] = [];
  const evidence_gaps: Record<string, unknown>[] = [];

  const transcript = hasType(docs, DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT);
  const notice = hasType(docs, DOCUMENT_TYPES.IRS_NOTICE);
  const w2 = hasType(docs, DOCUMENT_TYPES.W2);
  const taxReturn = hasType(docs, DOCUMENT_TYPES.TAX_RETURN);

  const yearMatch = text.match(TAX_YEAR_RE);
  const taxYear = yearMatch?.[1] ?? null;
  const reportedBalance = parseBalanceFromText(text);
  const transcriptBalance = transcript ? parseBalanceFromText(transcript.text ?? "") : null;

  if (taxYear) {
    facts.push({
      fact_id: "TAX_YEAR",
      status: transcript || notice || taxReturn ? "VERIFIED" : "REPORTED",
      value: taxYear,
      sources: transcript
        ? [sourceForDoc(transcript, "tax_period")]
        : notice
          ? [sourceForDoc(notice, "tax_period")]
          : [userStatementSource()],
    });
  } else {
    facts.push({
      fact_id: "TAX_YEAR",
      status: "UNKNOWN",
      value: null,
      sources: [],
      kind: "EVIDENCE_GAP",
      blocks_goal_progress: true,
    });
    evidence_gaps.push({ fact_id: "TAX_YEAR", reason: "No tax year established" });
  }

  if (transcript && transcriptBalance != null) {
    facts.push({
      fact_id: "ACCOUNT_BALANCE",
      status: "VERIFIED",
      value: transcriptBalance,
      sources: [sourceForDoc(transcript, "account_balance")],
      note: "Promoted from IRS account transcript",
    });
  } else if (reportedBalance != null) {
    facts.push({
      fact_id: "ACCOUNT_BALANCE",
      status: "REPORTED",
      value: reportedBalance,
      sources: [userStatementSource()],
      kind: "UNVERIFIED_CLAIM",
      promotion_on: {
        when_evidence: "ACCOUNT_BALANCE verified from IRS account transcript",
        becomes: "VERIFIED",
      },
    });
    unverified_claims.push({ fact_id: "ACCOUNT_BALANCE", value: reportedBalance });
    facts.push({
      fact_id: "TRANSCRIPT_ON_FILE",
      status: "UNKNOWN",
      value: null,
      sources: [],
      kind: "EVIDENCE_GAP",
      blocks_goal_progress: true,
    });
    evidence_gaps.push({ fact_id: "TRANSCRIPT_ON_FILE", reason: "Balance reported without transcript" });
  } else if (CANT_PAY_RE.test(text) || /\bowe\b/i.test(text)) {
    facts.push({
      fact_id: "ACCOUNT_BALANCE",
      status: "UNKNOWN",
      value: null,
      sources: [],
      kind: "EVIDENCE_GAP",
      blocks_goal_progress: true,
    });
    evidence_gaps.push({ fact_id: "ACCOUNT_BALANCE", reason: "Balance not established" });
  }

  if (transcript) {
    facts.push({
      fact_id: "TRANSCRIPT_ON_FILE",
      status: "VERIFIED",
      value: true,
      sources: [sourceForDoc(transcript, "document_type")],
    });
  }

  if (notice || CP2000_RE.test(text) || LEVY_RE.test(text)) {
    const code =
      (notice?.text ?? text).match(/\b(CP|LT|LTR)\s?-?\d{2,4}[A-Z]?\b/i)?.[0]?.toUpperCase().replace(/\s+/g, "") ??
      null;
    facts.push({
      fact_id: "NOTICE_CODE",
      status: notice ? "VERIFIED" : "REPORTED",
      value: code,
      sources: notice ? [sourceForDoc(notice, "notice_code")] : [userStatementSource()],
      kind: notice ? undefined : "UNVERIFIED_CLAIM",
    });
  }

  if (w2 && taxReturn) {
    facts.push({
      fact_id: "W2_AND_RETURN_PRESENT",
      status: "VERIFIED",
      value: true,
      sources: [sourceForDoc(w2, "document_type"), sourceForDoc(taxReturn, "document_type")],
    });
  }

  let posture: LedgerPosture | null = null;
  if (LEVY_RE.test(text) || (notice && /levy|lt11/i.test(notice.fileName ?? ""))) {
    posture = {
      posture_id: "COLLECTION_LEVY_RISK",
      value: "collection_active",
      supersedes: "balance_due_only",
      superseded_by: null,
    };
  } else if (transcript || notice) {
    posture = {
      posture_id: "AGENCY_MATTER_OPEN",
      value: "agency_matter",
      supersedes: "situation_only",
      superseded_by: null,
    };
  }

  const event_timeline: LedgerTimelineEvent[] = facts
    .filter((f) => f.status === "VERIFIED")
    .map((f) => ({ event_id: `evt_${f.fact_id}`, fact_id: f.fact_id, status: f.status, superseded_by: null }));

  return {
    version: 1,
    facts,
    conflicts: [],
    unverified_claims,
    evidence_gaps,
    event_timeline,
    current_posture: posture,
    built_at: new Date().toISOString(),
  };
}

export function ledgerFact(ledger: FactLedger | null | undefined, factId: string): LedgerFact | undefined {
  return ledger?.facts.find((f) => f.fact_id === factId);
}

export function dedupeDocumentsByHash<T extends { contentHash?: string | null; duplicateOfId?: string | null; id?: string | null }>(
  docs: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const doc of docs) {
    if (doc.duplicateOfId) continue;
    const hash = String(doc.contentHash ?? "").trim();
    if (hash) {
      if (seen.has(hash)) continue;
      seen.add(hash);
    }
    out.push(doc);
  }
  return out;
}
