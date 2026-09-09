/**
 * Package V — QA + letter playbook honesty.
 * Fail-closed sanitize for thin debt Q&A and response-letter drafts;
 * no invented FTA / installment / OIC / CNC / dollar-threshold playbooks.
 */
import { NOTICE_RESOLUTION_PLAYBOOK } from "./notice-honesty";

export const QA_LETTER_RESOLUTION_PLAYBOOK = NOTICE_RESOLUTION_PLAYBOOK;

const THIN_FIXTURE =
  /owe\s+(the\s+)?irs|owe\s+(some\s+)?money|not\s+sure\s+how\s+much|what\s+i\s+need\s+to\s+do/i;

const ESTABLISHED_AMOUNT =
  /(?:\$\s?\d[\d,]*(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})+(?:\.\d{2})?\b)/;

const IRS_RECORD_ANCHOR =
  /account\s+transcript|transcript\s+shows|irs\s+(shows|record|account)|notice\s+(cp|lt)|balance\s+due\s+of|owed?\s+\$/i;

export function hasEstablishedDebtAmount(text: string): boolean {
  const blob = String(text ?? "");
  if (!ESTABLISHED_AMOUNT.test(blob)) return false;
  // Prefer explicit IRS/record anchors; still accept clear stated balances.
  if (IRS_RECORD_ANCHOR.test(blob)) return true;
  return /balance|amount\s+(due|owed)|owe[sd]?\s+\$|\$[\d,]+\.\d{2}/i.test(blob);
}

/** Thin debt Q&A: user is discussing IRS money owed without an established amount. */
export function isThinDebtQaContext(opts: {
  question: string;
  conversation?: string;
  caseEvidence?: string;
}): boolean {
  const evidence = String(opts.caseEvidence ?? "");
  const convo = `${opts.conversation ?? ""}\n${opts.question}`;
  if (hasEstablishedDebtAmount(evidence) || hasEstablishedDebtAmount(convo)) return false;
  const blob = `${convo}\n${evidence}`;
  if (THIN_FIXTURE.test(blob)) return true;
  return /owe|owing|balance\s+due|irs.*(money|debt|owe)|not\s+sure\s+how\s+much/i.test(blob);
}

export function sparseThinDebtQaAnswer(): string {
  return [
    "You reported owing the IRS money, but we do not yet have an established amount or IRS account record.",
    "Next: identify what the IRS shows — an Account Transcript (and any notice you received) establishes the period, balance, and recent activity.",
    "Until that record is on file, we cannot recommend a specific resolution path or dollar-threshold program.",
  ].join(" ");
}

function stripPlaybookSentences(text: string, fallback: string): string {
  if (!text.trim()) return text;
  const parts = text.split(/(?<=[.!?])\s+/);
  const kept = parts.filter((sentence) => !QA_LETTER_RESOLUTION_PLAYBOOK.test(sentence));
  if (kept.length > 0) return kept.join(" ").trim();
  return fallback;
}

/**
 * Fail-closed sanitize of Pipeline A Q&A free-text.
 */
export function sanitizeQaAnswer(
  answer: string,
  opts: { question: string; conversation?: string; caseEvidence?: string },
): { answer: string; sanitized: boolean; thin: boolean } {
  const thin = isThinDebtQaContext(opts);
  let next = String(answer ?? "").trim();
  let sanitized = false;
  if (!next) return { answer: next, sanitized, thin };

  if (thin && QA_LETTER_RESOLUTION_PLAYBOOK.test(next)) {
    const cleaned = stripPlaybookSentences(next, sparseThinDebtQaAnswer());
    if (cleaned !== next) {
      next = cleaned;
      sanitized = true;
    }
  }

  // Even after sentence strip, residual playbook tokens → replace with sparse copy.
  if (thin && QA_LETTER_RESOLUTION_PLAYBOOK.test(next)) {
    next = sparseThinDebtQaAnswer();
    sanitized = true;
  }

  return { answer: next, sanitized, thin };
}

/** Thin letter: no allowed/statable amounts and context does not establish a figure. */
export function isThinLetterContext(opts: {
  context: string;
  caseEvidence?: string;
  allowedAmounts?: number[];
}): boolean {
  if ((opts.allowedAmounts ?? []).some((n) => Number.isFinite(n) && n > 0)) return false;
  const blob = `${opts.caseEvidence ?? ""}\n${opts.context}`;
  return !hasEstablishedDebtAmount(blob);
}

export function sparseThinLetterParagraph(): string {
  return (
    "I am writing regarding my tax account. I have not yet confirmed the exact balance or period " +
    "from IRS records. Please advise what the account currently shows. This letter is not a request " +
    "for any specific relief or collection alternative."
  );
}

/**
 * Fail-closed sanitize of response-letter draft text.
 * Keeps the existing unverified-amount guard's role; this only strips speculative playbooks.
 */
export function sanitizeLetterDraft(
  draft: string,
  opts: { context: string; caseEvidence?: string; allowedAmounts?: number[] },
): { draft: string; sanitized: boolean; thin: boolean } {
  const thin = isThinLetterContext(opts);
  let next = String(draft ?? "").trim();
  let sanitized = false;
  if (!next) return { draft: next, sanitized, thin };

  if (thin && QA_LETTER_RESOLUTION_PLAYBOOK.test(next)) {
    const cleaned = stripPlaybookSentences(next, sparseThinLetterParagraph());
    if (cleaned !== next) {
      next = cleaned;
      sanitized = true;
    }
  }

  if (thin && QA_LETTER_RESOLUTION_PLAYBOOK.test(next)) {
    // Preserve letter skeleton (greeting/closing) when possible; rewrite body lines.
    const lines = next.split(/\n/);
    const rewritten = lines.map((line) =>
      QA_LETTER_RESOLUTION_PLAYBOOK.test(line) ? sparseThinLetterParagraph() : line,
    );
    const joined = rewritten.join("\n").trim();
    if (joined !== next) {
      next = joined;
      sanitized = true;
    }
  }

  if (thin && QA_LETTER_RESOLUTION_PLAYBOOK.test(next)) {
    next = next.replace(QA_LETTER_RESOLUTION_PLAYBOOK, "[path not established]");
    sanitized = true;
  }

  return { draft: next, sanitized, thin };
}
