/**
 * Package B — dynamic next ask helpers (pure, no server-only).
 * Prefer evidence CTAs when the user already said they don't know the amount.
 */

export type ClarifyQuestionLike = { key: string; text: string; placeholder: string };

export function amountUnknownFromText(text: string): boolean {
  const t = text.toLowerCase();
  if (!t.trim()) return false;
  // Explicit ignorance of amount
  if (
    /(not sure|don'?t know|do not know|unsure|no idea|unknown).{0,40}(how much|what i owe|the amount|amount|balance|owe)/i.test(
      t,
    ) ||
    /(how much|what i owe|the amount|balance).{0,40}(not sure|don'?t know|do not know|unsure|unknown)/i.test(t)
  ) {
    return true;
  }
  // Soft: "some money" / "owe something" without a dollar figure
  const hasDollar = /\$\s?[\d]/.test(text);
  if (!hasDollar && /\b(owe|owing|balance|debt)\b/i.test(t) && /\b(some money|something|not sure what)\b/i.test(t)) {
    return true;
  }
  return false;
}

export function preferEvidenceAsk(opts: {
  narrative: string;
  hasTranscript: boolean;
  hasNoticeDoc: boolean;
  balanceIssueOpen: boolean;
}): ClarifyQuestionLike | null {
  if (!opts.balanceIssueOpen) return null;
  if (opts.hasTranscript) return null;
  if (!amountUnknownFromText(opts.narrative)) return null;

  if (!opts.hasNoticeDoc) {
    return {
      key: "prefer_evidence",
      text: "Do you have an IRS notice or Account Transcript that shows what you owe? Upload either if you have it — or say you need help getting your transcript. If you already know the balance from another source, you can type that amount instead.",
      placeholder: "Upload notice/transcript, say I need help getting it, or enter the amount if you know it...",
    };
  }
  return {
    key: "have_transcript",
    text: "An IRS Account Transcript is the best next record — free and usually instant from your IRS online account. Do you have it, can you get it, or do you need help?",
    placeholder: "Answer yes, no, or I need help getting it...",
  };
}
