// IRS transcript reader. Digital transcripts carry a text layer, so their
// transaction rows can be read deterministically — no model call required.
// Kept dependency-free so both the analysis pipeline and tests can use it.

export type TranscriptTx = { code: string; description: string; date: string; amount: number };

export type TranscriptData = {
  transactions: TranscriptTx[];
  accountBalance: number | null;
  accountBalanceAsOf: string | null;
  refundIssued: TranscriptTx | null;
  offsets: TranscriptTx[];
  hold: boolean;
  penalties: TranscriptTx[];
  taxPeriods: string[];
};

const ROW_RE = /\b(\d{3})\s+([A-Za-z][^\n$]{2,80}?)\s+(\d{2}-\d{2}-\d{4})\s+(-?\$?[\d,]+\.\d{2})/g;
// Looser detector used only for completeness accounting: a transcript row
// always starts with a three-digit transaction code on its own line.
const ROW_CANDIDATE_RE = /^\s*\d{3}\s+[A-Za-z]/gm;

function parseAmount(s: string): number {
  return Number(s.replace(/[$,\s]/g, ""));
}

export function parseTranscript(text: string): TranscriptData {
  const transactions: TranscriptTx[] = [];
  let m: RegExpExecArray | null;
  ROW_RE.lastIndex = 0;
  while ((m = ROW_RE.exec(text))) {
    const amount = parseAmount(m[4]);
    if (!Number.isFinite(amount)) continue;
    transactions.push({ code: m[1], description: m[2].replace(/\s+/g, " ").trim(), date: m[3], amount });
  }
  const balMatch = text.match(/ACCOUNT\s+BALANCE:?\s*(-?\$?[\d,]+\.\d{2})/i);
  const asOfMatch = text.match(/AS\s+OF:?\s*([A-Za-z]{3,9}\.?\s+\d{1,2},\s*\d{4}|\d{2}-\d{2}-\d{4})/i);
  const periods = Array.from(
    new Set(
      (text.match(/TAX\s+PERIOD\s+ENDING:?\s*[^\n]*?(20\d{2})/gi) ?? [])
        .map((line) => line.match(/(20\d{2})/)?.[1] ?? "")
        .filter(Boolean),
    ),
  );
  return {
    transactions,
    accountBalance: balMatch ? parseAmount(balMatch[1]) : null,
    accountBalanceAsOf: asOfMatch ? asOfMatch[1].trim() : null,
    refundIssued: transactions.find((t) => t.code === "846") ?? null,
    offsets: transactions.filter((t) => t.code === "826"),
    hold: transactions.some((t) => t.code === "570"),
    penalties: transactions.filter((t) => ["276", "196", "166"].includes(t.code)),
    taxPeriods: periods,
  };
}

// How many transaction rows appear to exist, so extraction completeness can be
// measured instead of assumed.
export function countTransactionRowCandidates(text: string): number {
  ROW_CANDIDATE_RE.lastIndex = 0;
  return (text.match(ROW_CANDIDATE_RE) ?? []).length;
}

export function looksLikeTranscript(text: string): boolean {
  return /account\s+transcript|record\s+of\s+account|wage\s+and\s+income\s+transcript|return\s+transcript/i.test(text);
}
