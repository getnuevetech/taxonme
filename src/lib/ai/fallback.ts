import "server-only";
import { db } from "../db";

// Deterministic (no-AI) case analyzer. Used when no AI provider is configured
// yet, and as the safety net if all providers fail. It performs real
// extraction and arithmetic — amounts, years, notice codes, refund
// discrepancies — and grounds notice explanations in the admin-curated IRS
// knowledge base. Results are labeled preliminary in the UI.

type Json = Record<string, unknown>;

type MoneyMention = { amount: number; before: string; after: string };

function moneyMentions(text: string): MoneyMention[] {
  const out: MoneyMention[] = [];
  const re = /\$\s?([\d][\d,]*(?:\.\d{1,2})?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const amount = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out.push({
      amount,
      before: text.slice(Math.max(0, m.index - 80), m.index).toLowerCase(),
      after: text.slice(m.index + m[0].length, m.index + m[0].length + 80).toLowerCase(),
    });
  }
  return out;
}

export type FallbackResult = {
  facts: Json;
  issues: Json[];
  pathSteps: { title: string; description: string; action_key: string }[];
};

export async function fallbackAnalyze(
  situation: string,
  goal: string,
  documentsText: string,
): Promise<FallbackResult> {
  const text = `${situation}\n${goal}\n${documentsText}`;
  const lower = text.toLowerCase();

  const years = Array.from(new Set(text.match(/\b(19|20)\d{2}\b/g) ?? []))
    .map(Number)
    .filter((y) => y > 1990 && y < 2100 && !`${y}`.startsWith("19"))
    .sort();
  const primaryYear = years.length ? years[years.length - 1] : null;

  const noticeCodes = Array.from(
    new Set((text.toUpperCase().match(/\b(CP|LT|LTR)\s?-?\d{2,4}[A-Z]?\b/g) ?? []).map((c) => c.replace(/\s|-/g, ""))),
  );

  // Classify every dollar amount by its surrounding words, in priority order
  // so one amount is never counted twice (owed first, then received, then expected).
  const mentions = moneyMentions(text);
  const claimed = new Set<MoneyMention>();

  const balanceDue = mentions.find((m) =>
    /(owe|owes|owed to|balance|amount due|debt|assessed|pay(?:ing)? (?:the )?irs|saying i owe)/.test(m.before.slice(-40)),
  );
  if (balanceDue) claimed.add(balanceDue);

  const receivedRefund = mentions.find(
    (m) => !claimed.has(m) && /(refund was|refund of only|only received|received|got|deposited|came to)/.test(m.before.slice(-40)) && /refund/.test(lower),
  );
  if (receivedRefund) claimed.add(receivedRefund);

  const expectedRefund = mentions.find(
    (m) =>
      !claimed.has(m) &&
      (/(instead of|expected|expecting|should have (?:been|gotten)|supposed to (?:be|get)|claimed|was owed)/.test(m.before.slice(-40)) ||
        /^\s*(?:that\s+)?(?:i|we)?\s*(?:was|were)?\s*expect/.test(m.after)),
  );
  if (expectedRefund) claimed.add(expectedRefund);

  const issues: Json[] = [];
  const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  // Refund discrepancy with real arithmetic.
  if (expectedRefund && receivedRefund && expectedRefund.amount > receivedRefund.amount) {
    const diff = Math.round((expectedRefund.amount - receivedRefund.amount) * 100) / 100;
    issues.push({
      issue_type: "refund_discrepancy",
      tax_year: primaryYear,
      title: `${usd(diff)} refund difference identified`,
      what_we_know: `Your information indicates an expected refund of ${usd(expectedRefund.amount)}, but ${usd(receivedRefund.amount)} was received. That leaves ${usd(diff)} unaccounted for. Common causes: the refund was applied (offset) to another tax year or debt, or the IRS adjusted the return.`,
      what_we_dont_know: `Where the remaining ${usd(diff)} was applied. Your IRS account transcript will show this as a transaction code (for example, TC 826 "credit transferred").`,
      expected_amount: expectedRefund.amount,
      received_amount: receivedRefund.amount,
      difference_amount: diff,
      confidence: "medium",
      priority: "high",
      state: "action_needed",
      next_action: "GET_TRANSCRIPT",
    });
  } else if (/refund/.test(lower)) {
    issues.push({
      issue_type: "refund_discrepancy",
      tax_year: primaryYear,
      title: "Possible refund issue",
      what_we_know: "Your summary mentions a refund concern, but we couldn't extract both the expected and received amounts.",
      what_we_dont_know: "The exact expected and received refund amounts. Your tax return and account transcript will confirm them.",
      confidence: "low",
      priority: "medium",
      state: "info_needed",
      next_action: "UPLOAD_DOCUMENTS",
    });
  }

  // Balance due.
  if (balanceDue) {
    issues.push({
      issue_type: "balance_due",
      tax_year: primaryYear,
      title: `Possible balance due of ${usd(balanceDue.amount)}`,
      what_we_know: `Your information mentions ${usd(balanceDue.amount)} owed to the IRS${primaryYear ? ` for tax year ${primaryYear}` : ""}. If you can't pay in full, payment plans are usually available (short-term up to 180 days, or a monthly installment agreement).`,
      what_we_dont_know: "Whether penalties and interest are included, and whether the assessment itself is correct — the notice and your account transcript will confirm.",
      confidence: "medium",
      priority: "high",
      state: "action_needed",
      next_action: "GET_TRANSCRIPT",
    });
  } else if (/(owe|balance|debt|amount due)/.test(lower)) {
    issues.push({
      issue_type: "balance_due",
      tax_year: primaryYear,
      title: "Possible balance due",
      what_we_know: "Your summary mentions owing the IRS, but we couldn't extract the exact amount.",
      what_we_dont_know: "The confirmed balance, and how much of it is tax versus penalties and interest.",
      confidence: "low",
      priority: "medium",
      state: "info_needed",
      next_action: "UPLOAD_DOCUMENTS",
    });
  }

  // Notice-specific issues, grounded in the knowledge base.
  for (const code of noticeCodes) {
    const kb = await db.knowledgeSource.findFirst({
      where: { reference: { contains: code }, isActive: true },
    });
    issues.push({
      issue_type: "notice_response",
      tax_year: primaryYear,
      title: `IRS notice ${code}`,
      what_we_know: kb
        ? `${kb.title}: ${kb.content.slice(0, 400)}${kb.content.length > 400 ? "…" : ""}`
        : `You mentioned notice ${code}. Upload the notice itself so we can confirm its type, amount, and response deadline.`,
      what_we_dont_know: "The exact deadline printed on your copy of the notice — check the date near the top right and add it to your deadlines.",
      confidence: kb ? "medium" : "low",
      priority: code.startsWith("LT") ? "urgent" : "high",
      state: code.startsWith("LT") ? "urgent" : "action_needed",
      next_action: "DRAFT_LETTER",
      irs_basis: kb ? kb.reference : "",
    });
  }

  if (/(penalt|interest)/.test(lower)) {
    issues.push({
      issue_type: "penalty",
      tax_year: primaryYear,
      title: "Penalty relief may be available",
      what_we_know: "Your situation mentions penalties or interest. If you have a clean compliance history for the prior 3 years, first-time penalty abatement often removes failure-to-file and failure-to-pay penalties.",
      what_we_dont_know: "Your compliance history and which penalties were assessed — your account transcript lists them by transaction code.",
      confidence: "medium",
      priority: "medium",
      state: "review",
      next_action: "GET_TRANSCRIPT",
    });
  }

  if (/(didn'?t file|not filed|unfiled|late filing|missed filing|never filed)/.test(lower)) {
    issues.push({
      issue_type: "missing_return",
      tax_year: primaryYear,
      title: "Possible unfiled return",
      what_we_know: "Unfiled returns usually must be filed before other resolutions (payment plans, penalty relief) become available. The IRS may have filed a 'substitute for return' that overstates what you owe.",
      what_we_dont_know: "Which years are unfiled — your wage & income transcripts reconstruct the income the IRS has on file.",
      confidence: "medium",
      priority: "high",
      state: "action_needed",
      next_action: "GET_TRANSCRIPT",
    });
  }

  if (issues.length === 0) {
    issues.push({
      issue_type: "other",
      title: "Tax situation review",
      what_we_know: "We recorded your summary and goal.",
      what_we_dont_know: "The specifics — upload supporting documents (notices, returns, transcripts) so the analysis can verify amounts and dates.",
      confidence: "low",
      priority: "medium",
      state: "info_needed",
      next_action: "UPLOAD_DOCUMENTS",
    });
  }

  // Path forward: every step carries an action_key the progress verifier can
  // check against real evidence — steps are never just checked off.
  const pathSteps: FallbackResult["pathSteps"] = [];
  pathSteps.push({
    title: "Add your supporting documents",
    description: "Upload the IRS notice, your tax return, and any W-2/1099s. Completes automatically when your case has documents.",
    action_key: "UPLOAD_DOCUMENTS",
  });
  pathSteps.push({
    title: "Get your IRS account transcript",
    description: "Your transcript shows exactly what the IRS has on file — including where any missing refund went. Completes when a transcript is in your case documents.",
    action_key: "GET_TRANSCRIPT",
  });
  pathSteps.push({
    title: "Re-run the analysis with your documents",
    description: "Once documents are in, re-run the analysis so every amount is verified against them.",
    action_key: "REVIEW_ANALYSIS",
  });
  if (noticeCodes.length > 0) {
    pathSteps.push({
      title: "Draft your response letter",
      description: "Generate a professional reply, edit it, and mail it before the notice deadline. Completes when a letter exists.",
      action_key: "DRAFT_LETTER",
    });
  }
  if (/(payment plan|installment|can'?t pay|afford)/.test(lower) || balanceDue) {
    pathSteps.push({
      title: "Prepare a payment plan request (Form 9465)",
      description: "Use the guided form wizard to prepare an installment agreement request. Completes when the form is finished.",
      action_key: "COMPLETE_FORM_9465",
    });
  }
  pathSteps.push({
    title: "Confirm the resolution with the IRS",
    description: "After you've responded or arranged payment, confirm the IRS updated your account (letter or transcript). Mark this done yourself once confirmed.",
    action_key: "",
  });

  const facts: Json = {
    tax_years: years,
    notices_received: noticeCodes,
    expected_refund: expectedRefund?.amount ?? null,
    received_refund: receivedRefund?.amount ?? null,
    balance_due: balanceDue?.amount ?? null,
    amounts_mentioned: mentions.map((m) => m.amount),
    user_goal: goal,
    unknowns: ["Automated AI verification pending — results based on rule-based extraction"],
  };

  return { facts, issues, pathSteps };
}
