import "server-only";
import { db } from "./db";

// The clarifying interview: when the analysis is thin (missing amounts,
// years, dates, documents), the app asks the customer targeted questions in a
// chat conversation. Every answer is folded back into the case narrative in a
// form the extraction engine parses, and the analysis re-runs automatically —
// so each answer visibly sharpens the findings.

export type ClarifyQuestion = { key: string; text: string };

// How each answer is written back into the case narrative. The phrasing
// matters: it gives the amount-classifier the context words it needs.
export function situationLine(key: string, questionText: string, answer: string): string {
  const a = answer.trim();
  switch (key) {
    case "tax_year":
      return `[Clarified] Tax year(s) involved: ${a}.`;
    case "refund_expected":
      return `[Clarified] My tax return shows I expected a refund of ${a}.`;
    case "refund_received":
      return `[Clarified] I actually received ${a} as my refund.`;
    case "balance_amount":
      return `[Clarified] The IRS says I owe ${a}.`;
    case "notice_details":
      return `[Clarified] My IRS notice: ${a}.`;
    case "unfiled_years":
      return `[Clarified] Unfiled return details: ${a}.`;
    case "have_transcript":
      return `[Clarified] About my IRS Account Transcript: ${a}.`;
    default:
      return `[Clarified] ${questionText} — ${a}.`;
  }
}

/**
 * The next unanswered question for this case, or null when the interview is
 * complete. Questions are derived from what the analysis actually lacks.
 */
export async function nextClarifyQuestion(caseId: string): Promise<ClarifyQuestion | null> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      issues: true,
      documents: { where: { deletedAt: null } },
      clarifyMessages: { where: { role: "user" } },
    },
  });
  if (!c || c.status === "closed") return null;

  const answered = new Set(c.clarifyMessages.map((m) => m.questionKey));
  const hasTranscript = c.documents.some((d) => d.docKind === "transcript");
  const refundIssue = c.issues.find((i) => i.issueType === "refund_discrepancy");
  const balanceIssue = c.issues.find((i) => i.issueType === "balance_due");
  const noticeIssue = c.issues.find((i) => i.issueType === "notice_response");
  const unfiledIssue = c.issues.find((i) => i.issueType === "missing_return");
  const hasYear = c.issues.some((i) => i.taxYear);

  const questions: (ClarifyQuestion & { needed: boolean })[] = [
    {
      key: "tax_year",
      text: "Which tax year (or years) does your situation involve? For example: 2024, or 2023 and 2024.",
      needed: !hasYear,
    },
    {
      key: "refund_expected",
      text: "Let's pin down the refund numbers. What refund amount did your tax return say you were getting? It's on Form 1040, line 35a — an approximate figure like $3,214 works.",
      needed: Boolean(refundIssue && refundIssue.expectedCents === null),
    },
    {
      key: "refund_received",
      text: "And how much refund actually arrived (bank deposit or check), and roughly on what date? For example: $412 on March 3. If nothing arrived, say $0.",
      needed: Boolean(refundIssue && refundIssue.receivedCents === null),
    },
    {
      key: "balance_amount",
      text: "What amount does the IRS say you owe, and where does that number come from — a letter/notice, your IRS online account, or your own estimate? For example: $2,800 from a CP14 notice.",
      needed: Boolean(balanceIssue && balanceIssue.expectedCents === null && balanceIssue.differenceCents === null),
    },
    {
      key: "notice_details",
      text: "Look at the top-right corner of your IRS letter: what's the notice code (like CP2000 or LT11), the notice date, and the 'respond by' deadline printed on it?",
      needed: Boolean(noticeIssue),
    },
    {
      key: "unfiled_years",
      text: "Which years haven't been filed yet, and do you still have the income documents (W-2s / 1099s) for those years?",
      needed: Boolean(unfiledIssue),
    },
    {
      key: "have_transcript",
      text: "Do you have your IRS Account Transcript, or can you get it? It's free and instant from your IRS online account (irs.gov/your-account) and it settles the exact amounts. Answer: yes / no / I need help getting it.",
      needed: !hasTranscript,
    },
    {
      key: "anything_else",
      text: "Last one: anything else we should know? Payments you've already made, letters you've sent the IRS, a payment plan you had before, or life events that affected your filing.",
      needed: true,
    },
  ];

  for (const q of questions) {
    if (q.needed && !answered.has(q.key)) return { key: q.key, text: q.text };
  }
  return null;
}
