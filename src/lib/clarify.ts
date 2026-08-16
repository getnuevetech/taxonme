import "server-only";
import { db } from "./db";

// The clarifying interview: when the analysis is thin (missing amounts,
// years, dates, documents), the app asks the customer targeted questions in a
// chat conversation. Every answer is folded back into the case narrative in a
// form the extraction engine parses, and the analysis re-runs automatically —
// so each answer visibly sharpens the findings.

export type ClarifyQuestion = { key: string; text: string; placeholder: string };

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
      issues: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      documents: { where: { deletedAt: null } },
      clarifyMessages: { where: { role: "user" } },
    },
  });
  if (!c || c.status === "closed") return null;

  const answered = new Set(c.clarifyMessages.map((m) => m.questionKey));
  for (const issue of c.issues) {
    let unclear: string[] = [];
    try {
      const parsed = JSON.parse(issue.unclearJson || "[]");
      if (Array.isArray(parsed)) unclear = parsed.map(String).filter(Boolean);
    } catch {
      unclear = [];
    }
    for (const [index, item] of unclear.entries()) {
      const key = `unclear:${issue.id}:${index}`;
      if (!answered.has(key)) {
        const year = issue.taxYear ? ` for ${issue.taxYear}` : "";
        return {
          key,
          text: `About "${issue.title}"${year}: ${item}`,
          placeholder: "Answer this point with what you know, or say you are not sure...",
        };
      }
    }
  }
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
      placeholder: "Enter the year or years this case is about...",
      needed: !hasYear,
    },
    {
      key: "refund_expected",
      text: "Let's pin down the refund numbers. What refund amount did your tax return say you were getting? It's on Form 1040, line 35a — an approximate dollar amount is fine.",
      placeholder: "Enter the refund shown on your return, or say you are not sure...",
      needed: Boolean(refundIssue && refundIssue.expectedCents === null),
    },
    {
      key: "refund_received",
      text: "And how much refund actually arrived by bank deposit or check, and roughly on what date? If nothing arrived, say that.",
      placeholder: "Enter what arrived and when, or say no refund arrived...",
      needed: Boolean(refundIssue && refundIssue.receivedCents === null),
    },
    {
      key: "balance_amount",
      text: "What amount does the IRS say you owe, and where does that number come from — a letter/notice, your IRS online account, or your own estimate?",
      placeholder: "Enter the amount and source, such as a notice or online account...",
      needed: Boolean(balanceIssue && balanceIssue.expectedCents === null && balanceIssue.differenceCents === null),
    },
    {
      key: "notice_details",
      text: "Look at the top-right corner of your IRS letter: what's the notice code (like CP2000 or LT11), the notice date, and the 'respond by' deadline printed on it?",
      placeholder: "Enter the notice code, notice date, and response deadline...",
      needed: Boolean(noticeIssue),
    },
    {
      key: "unfiled_years",
      text: "Which years haven't been filed yet, and do you still have the income documents (W-2s / 1099s) for those years?",
      placeholder: "List the unfiled years and which W-2/1099 documents you still have...",
      needed: Boolean(unfiledIssue),
    },
    {
      key: "have_transcript",
      text: "Do you have your IRS Account Transcript, or can you get it? It's free and instant from your IRS online account (irs.gov/your-account) and it settles the exact amounts. Answer: yes / no / I need help getting it.",
      placeholder: "Answer yes, no, or I need help getting it...",
      needed: !hasTranscript,
    },
    {
      key: "anything_else",
      text: "Last one: anything else we should know? Payments you've already made, letters you've sent the IRS, a payment plan you had before, or life events that affected your filing.",
      placeholder: "Add any other facts that may affect this case...",
      needed: true,
    },
  ];

  for (const q of questions) {
    if (q.needed && !answered.has(q.key)) return { key: q.key, text: q.text, placeholder: q.placeholder };
  }
  return null;
}
