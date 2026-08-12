import "server-only";
import { db } from "../db";

// Deterministic (no-AI) case analyzer. Used when no AI provider is configured
// yet, and as the safety net if all providers fail. It performs real
// extraction and arithmetic — amounts, years, notice codes, refund
// discrepancies — grounds notice explanations in the admin-curated IRS
// knowledge base, detects contradictions between the customer's narrative and
// their documents, and labels every item with an evidence-based status
// (confirmed / likely / possible / needs_verification / not_supported) rather
// than an AI confidence score.

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

// Classify dollar amounts in a body of text by their surrounding words, in
// priority order so one amount is never counted twice.
function classifyAmounts(text: string) {
  const lower = text.toLowerCase();
  const mentions = moneyMentions(text);
  const claimed = new Set<MoneyMention>();

  const balanceDue = mentions.find((m) =>
    /(owe|owes|owed to|balance|amount due|debt|assessed|pay(?:ing)? (?:the )?irs|saying i owe)/.test(m.before.slice(-40)),
  );
  if (balanceDue) claimed.add(balanceDue);

  const receivedRefund = mentions.find(
    (m) => !claimed.has(m) && /(refund was|refund of only|only received|received|got|deposited|came to|refund issued)/.test(m.before.slice(-40)) && /refund/.test(lower),
  );
  if (receivedRefund) claimed.add(receivedRefund);

  const expectedRefund = mentions.find(
    (m) =>
      !claimed.has(m) &&
      (/(instead of|expected|expecting|should have (?:been|gotten)|supposed to (?:be|get)|claimed|was owed)/.test(m.before.slice(-40)) ||
        /^\s*(?:that\s+)?(?:i|we)?\s*(?:was|were)?\s*expect/.test(m.after)),
  );
  if (expectedRefund) claimed.add(expectedRefund);

  return { balanceDue, receivedRefund, expectedRefund, mentions };
}

// ---- IRS transcript reader: parses transaction-code rows and the account
// balance out of transcript text (digital PDFs carry a text layer), turning
// the IRS's own records into authoritative amounts. ----
type TranscriptTx = { code: string; description: string; date: string; amount: number };
type TranscriptData = {
  transactions: TranscriptTx[];
  accountBalance: number | null;
  refundIssued: TranscriptTx | null;
  offsets: TranscriptTx[];
  hold: boolean;
  penalties: TranscriptTx[];
};

function parseAmount(s: string): number {
  return Number(s.replace(/[$,\s]/g, ""));
}

export function parseTranscript(text: string): TranscriptData {
  const transactions: TranscriptTx[] = [];
  const rowRe = /\b(\d{3})\s+([A-Za-z][^\n$]{2,80}?)\s+(\d{2}-\d{2}-\d{4})\s+(-?\$?[\d,]+\.\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(text))) {
    const amount = parseAmount(m[4]);
    if (!Number.isFinite(amount)) continue;
    transactions.push({ code: m[1], description: m[2].replace(/\s+/g, " ").trim(), date: m[3], amount });
  }
  const balMatch = text.match(/ACCOUNT\s+BALANCE:?\s*(-?\$?[\d,]+\.\d{2})/i);
  const accountBalance = balMatch ? parseAmount(balMatch[1]) : null;
  return {
    transactions,
    accountBalance,
    refundIssued: transactions.find((t) => t.code === "846") ?? null,
    offsets: transactions.filter((t) => t.code === "826"),
    hold: transactions.some((t) => t.code === "570"),
    penalties: transactions.filter((t) => ["276", "196", "166"].includes(t.code)),
  };
}

export type FallbackConflict = { topic: string; description: string; resolution: string };

export type FallbackResult = {
  facts: Json;
  issues: Json[];
  pathSteps: { title: string; description: string; action_key: string }[];
  conflicts: FallbackConflict[];
};

export type DocInfo = { docKind: string; readable: boolean };

export async function fallbackAnalyze(
  situation: string,
  goal: string,
  documentsText: string,
  docs: DocInfo[] = [],
): Promise<FallbackResult> {
  const narrative = `${situation}\n${goal}`;
  const text = `${narrative}\n${documentsText}`;
  const lower = text.toLowerCase();
  const haveKinds = new Set(docs.map((d) => d.docKind));
  const hasDocs = docs.length > 0;
  const hasTranscript = haveKinds.has("transcript");
  const hasReturn = haveKinds.has("1040");
  const unreadableCount = docs.filter((d) => !d.readable).length;

  // ---- Amount extraction: narrative and documents SEPARATELY, so we can
  // detect contradictions and prefer documentary evidence. ----
  const fromNarrative = classifyAmounts(narrative);
  const fromDocs = documentsText.trim() ? classifyAmounts(documentsText) : null;
  const conflicts: FallbackConflict[] = [];
  const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

  // Pick the authoritative value per category: a documented figure beats the
  // narrative; a disagreement becomes an INFORMATION CONFLICT, never a guess.
  function reconcile(
    label: string,
    narrativeVal: MoneyMention | undefined,
    docVal: MoneyMention | undefined,
  ): { amount: number; fromDocument: boolean } | null {
    if (docVal && narrativeVal && Math.abs(docVal.amount - narrativeVal.amount) > 1) {
      conflicts.push({
        topic: label,
        description: `Your description indicates approximately ${usd(narrativeVal.amount)}, while your uploaded document shows ${usd(docVal.amount)}. Difference: ${usd(Math.abs(docVal.amount - narrativeVal.amount))}.`,
        resolution: `We are using ${usd(docVal.amount)} from your document as the current evidence. If that's not right, update your case summary and re-run the analysis.`,
      });
    }
    if (docVal) return { amount: docVal.amount, fromDocument: true };
    if (narrativeVal) return { amount: narrativeVal.amount, fromDocument: false };
    return null;
  }

  let balanceDue = reconcile("Amount owed", fromNarrative.balanceDue, fromDocs?.balanceDue);
  let receivedRefund = reconcile("Refund received", fromNarrative.receivedRefund, fromDocs?.receivedRefund);
  const expectedRefund = reconcile("Expected refund", fromNarrative.expectedRefund, fromDocs?.expectedRefund);

  // The transcript is the IRS's own record — its figures are authoritative.
  const transcript = parseTranscript(documentsText);
  if (transcript.refundIssued) {
    const t = transcript.refundIssued;
    if (receivedRefund && Math.abs(receivedRefund.amount - t.amount) > 1 && !receivedRefund.fromDocument) {
      conflicts.push({
        topic: "Refund received",
        description: `You reported receiving approximately ${usd(receivedRefund.amount)}, but your IRS transcript shows a refund of ${usd(t.amount)} issued on ${t.date}.`,
        resolution: `We are using the transcript figure (${usd(t.amount)}) as the current evidence.`,
      });
    }
    receivedRefund = { amount: t.amount, fromDocument: true };
  }
  if (transcript.accountBalance !== null && transcript.accountBalance > 0) {
    if (balanceDue && Math.abs(balanceDue.amount - transcript.accountBalance) > 1 && !balanceDue.fromDocument) {
      conflicts.push({
        topic: "Amount owed",
        description: `You reported owing approximately ${usd(balanceDue.amount)}, but your IRS transcript shows an account balance of ${usd(transcript.accountBalance)}.`,
        resolution: `We are using the transcript figure (${usd(transcript.accountBalance)}) as the current evidence.`,
      });
    }
    balanceDue = { amount: transcript.accountBalance, fromDocument: true };
  }
  const offsetTotal = transcript.offsets.reduce((s, o) => s + Math.abs(o.amount), 0);

  // Tax year detection. Priority: (1) years the customer explicitly calls a
  // "tax year", (2) the transcript's "Tax Period Ending", (3) other years —
  // with calendar DATES (e.g. "July 15, 2026", "07-15-2026") stripped first,
  // because a payment date is not a tax year.
  const stripDates = (s: string) =>
    s
      .replace(/\b\d{1,2}[-/]\d{1,2}[-/]20\d{2}\b/g, " ")
      .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+20\d{2}\b/gi, " ")
      .replace(/\b(?:as of|on|dated?|issued|received)\s+20\d{2}\b/gi, " ");
  const yearsFrom = (s: string) =>
    Array.from(new Set(stripDates(s).match(/\b20\d{2}\b/g) ?? []))
      .map(Number)
      .filter((y) => y > 2000 && y < 2100)
      .sort();
  const explicitMatch = narrative.match(/tax year\(?s?\)?[^.\n]{0,40}/i);
  const explicitYears = explicitMatch ? yearsFrom(explicitMatch[0]) : [];
  const taxPeriodYear = documentsText.match(/Tax Period Ending:[^\n]*?(20\d{2})/i)?.[1];
  const narrativeYears = explicitYears.length ? explicitYears : yearsFrom(narrative);
  const years = narrativeYears.length
    ? narrativeYears
    : taxPeriodYear
      ? [Number(taxPeriodYear)]
      : yearsFrom(text);
  const primaryYear = years.length ? years[years.length - 1] : null;

  const noticeCodes = Array.from(
    new Set((text.toUpperCase().match(/\b(CP|LT|LTR)\s?-?\d{2,4}[A-Z]?\b/g) ?? []).map((c) => c.replace(/\s|-/g, ""))),
  );

  const yearText = primaryYear ? `${primaryYear}` : "the year in question";

  // Product language only — the customer never hears about AI providers or
  // internal engines. Verification is described in terms of documents.
  const evidenceGuidance = (year: number | null) => {
    const yr = year ?? "the year in question";
    if (!hasDocs) {
      return {
        what: `To verify the numbers we need two specific documents: your IRS Account Transcript for ${yr} (downloads instantly from your IRS online account) and your tax return (Form 1040) for ${yr}.`,
        action: "UPLOAD_DOCUMENTS",
        state: "info_needed",
      };
    }
    if (!hasTranscript) {
      return {
        what: `You've added ${docs.length} document${docs.length === 1 ? "" : "s"} — the missing key piece is your IRS Account Transcript for ${yr}. It lists code-by-code what the IRS actually did (refunds issued, credits transferred, holds), which settles the numbers.`,
        action: "GET_TRANSCRIPT",
        state: "action_needed",
      };
    }
    if (unreadableCount > 0) {
      return {
        what: `${docs.length} document${docs.length === 1 ? "" : "s"} uploaded · ${unreadableCount} require${unreadableCount === 1 ? "s" : ""} verification. Your Account Transcript has been identified as the primary record for confirming this finding.`,
        action: "REVIEW",
        state: "review",
      };
    }
    return {
      what: `Your documents are on file. Re-run the analysis after adding anything new, and we'll verify every amount against them.`,
      action: "REVIEW",
      state: "review",
    };
  };

  // What the transcript actually says, code by code (shown as evidence).
  const transcriptDetail = () => {
    if (transcript.transactions.length === 0) return "";
    const parts: string[] = [];
    if (transcript.refundIssued) parts.push(`refund issued ${usd(Math.abs(transcript.refundIssued.amount))} on ${transcript.refundIssued.date} (TC 846)`);
    for (const o of transcript.offsets.slice(0, 3)) parts.push(`credit transferred ${usd(Math.abs(o.amount))} on ${o.date} (TC 826)`);
    if (transcript.hold) parts.push("a review hold (TC 570)");
    if (transcript.penalties.length) parts.push(`penalties/interest assessed totaling ${usd(transcript.penalties.reduce((s, p) => s + Math.abs(p.amount), 0))}`);
    if (transcript.accountBalance !== null) parts.push(`account balance ${usd(transcript.accountBalance)}`);
    return parts.length ? ` Your transcript shows: ${parts.join(" · ")}.` : "";
  };

  const evidenceLine = () =>
    !hasDocs
      ? `No documents are on file yet. Anything you upload is checked against every item in this case automatically.`
      : hasTranscript || transcript.transactions.length > 0
        ? `${docs.length} document${docs.length === 1 ? "" : "s"} uploaded, including your IRS Account Transcript — the IRS's own record of your account.${transcriptDetail()}${unreadableCount > 0 ? ` ${unreadableCount} scanned document${unreadableCount === 1 ? "" : "s"} still require${unreadableCount === 1 ? "s" : ""} verification.` : ""}`
        : `${docs.length} document${docs.length === 1 ? "" : "s"} uploaded${hasReturn ? ", including your tax return" : ""}. The missing keystone is your IRS Account Transcript — it is the IRS's own record and settles amounts definitively.`;

  const issues: Json[] = [];

  // ---------- Refund discrepancy with real arithmetic ----------
  if (expectedRefund && receivedRefund && expectedRefund.amount > receivedRefund.amount) {
    const diff = Math.round((expectedRefund.amount - receivedRefund.amount) * 100) / 100;
    const documented = expectedRefund.fromDocument || receivedRefund.fromDocument;
    // Transcript proof: when TC 826 transfers match the gap, the cause is
    // CONFIRMED from the IRS's own records — no guessing needed.
    const offsetConfirmed = offsetTotal > 0 && Math.abs(offsetTotal - diff) <= 1;
    const offsetDates = transcript.offsets.map((o) => o.date).join(", ");
    issues.push({
      issue_type: "refund_discrepancy",
      item_kind: "finding",
      evidence_status: offsetConfirmed ? "confirmed" : hasTranscript ? "likely" : documented ? "likely" : "needs_verification",
      evidence_strength: offsetConfirmed ? "strong" : hasTranscript && documented ? "strong" : hasTranscript || documented ? "moderate" : "limited",
      tax_year: primaryYear,
      title: offsetConfirmed
        ? `Refund offset confirmed — ${usd(diff)} applied to another balance`
        : `Refund discrepancy — ${usd(diff)} difference`,
      what_we_know: offsetConfirmed
        ? `Your expected refund was ${usd(expectedRefund.amount)}; the IRS issued ${usd(receivedRefund.amount)} (transcript TC 846${transcript.refundIssued ? ` on ${transcript.refundIssued.date}` : ""}) and transferred ${usd(offsetTotal)} to another balance (TC 826 on ${offsetDates}). The difference is fully accounted for by the offset.`
        : `Your ${expectedRefund.fromDocument ? "records indicate" : "information indicates"} an expected refund of ${usd(expectedRefund.amount)}, but ${receivedRefund.fromDocument ? "your records show" : "you report"} ${usd(receivedRefund.amount)} was actually issued. Difference: ${usd(diff)}.`,
      our_conclusion: offsetConfirmed
        ? `Confirmed from your transcript: the missing ${usd(diff)} wasn't lost — it was applied (offset) to another balance on ${offsetDates}. If that balance is your own back taxes, the money already reduced what you owe. If you dispute the underlying debt, that debt — not the refund — is the thing to challenge.`
        : `${usd(diff)} of your ${yearText} refund is unaccounted for. The pattern matches a refund offset, an IRS adjustment, or a partial hold — your Account Transcript identifies which one within its transaction codes.`,
      still_unclear: offsetConfirmed
        ? [
            `Which balance the ${usd(offsetTotal)} was applied to (the transcript for that other year/period shows it arriving)`,
            "Whether you agree with the underlying balance it was applied to",
          ]
        : [
            `Where the ${usd(diff)} was applied (offset, adjustment, or hold)`,
            hasTranscript ? `Which transaction code on your transcript explains it (e.g. TC 826 credit transferred, TC 570 hold)` : `What your ${yearText} Account Transcript shows — it lists the answer code by code`,
            `Whether any related IRS notice was issued that you haven't received or uploaded`,
          ],
      explanations: offsetConfirmed
        ? [
            { title: "Refund offset", detail: `Confirmed by your transcript: TC 826 transferred ${usd(offsetTotal)} on ${offsetDates} — the refund was applied to another balance.`, likelihood: "Confirmed" },
          ]
        : [
            { title: "Refund offset", detail: "Another federal or state debt (a prior tax year, state taxes, child support, or federal student loans) may have been applied against the refund. Shows as TC 826 on your transcript or a Treasury Offset notice.", likelihood: "Possible" },
            { title: "IRS adjustment", detail: "The IRS may have changed the amount of your refund (math corrections or credit changes). You would normally receive a notice such as a CP12.", likelihood: "Possible" },
            { title: "Refund hold or review", detail: "Part of the refund may be held pending review (TC 570). The available information does not yet establish whether a hold affected the payment.", likelihood: "Possible" },
          ],
      expected_amount: expectedRefund.amount,
      received_amount: receivedRefund.amount,
      difference_amount: diff,
      confidence: offsetConfirmed ? "high" : "medium",
      priority: offsetConfirmed ? "medium" : "high",
      state: offsetConfirmed || hasTranscript ? "review" : "action_needed",
      next_action: offsetConfirmed || hasTranscript ? "REVIEW" : "GET_TRANSCRIPT",
      alternative_action: "Have a TaxOnMe professional review the case with you.",
      analysis_outline: [
        { heading: "Your situation", detail: `You reported that you expected a refund of ${usd(expectedRefund.amount)} for ${yearText} but received ${usd(receivedRefund.amount)} — leaving ${usd(diff)} unaccounted for.${documented ? " Part of these figures comes directly from your uploaded records." : " These amounts come from your own words — if either is off, update the summary and re-run."}` },
        { heading: "Tax rules", detail: `Rule: refunds don't simply shrink — under IRS procedure the difference is an offset (refund applied to another debt), an adjustment (the IRS changed the return), or a hold (payment suspended for review). Why it matters to your case: each explanation has a different remedy, and your Account Transcript distinguishes them by transaction code (TC 826 credit transferred · CP12-type adjustment notices · TC 570 hold).`, source: "IRS Account Transcript transaction codes · Treasury Offset Program · CP12 notice guidance" },
        { heading: "Your evidence", detail: evidenceLine() },
        { heading: "Our conclusion", detail: offsetConfirmed
            ? `Confirmed: the transcript's TC 826 transfer${transcript.offsets.length > 1 ? "s" : ""} of ${usd(offsetTotal)} on ${offsetDates} account${transcript.offsets.length > 1 ? "" : "s"} for the entire ${usd(diff)} gap. The refund wasn't lost — it was applied to another balance.`
            : `The gap of ${usd(diff)} is real based on the figures available, and it is identifiable — none of the three explanations leaves the money untraceable. ${hasTranscript ? "Your transcript is on file; matching its codes against the gap resolves this finding." : "The single document that resolves this finding is your Account Transcript."}` },
        { heading: "Your next move", detail: offsetConfirmed
            ? `Check which balance received the ${usd(offsetTotal)}: if it's your own back taxes, verify that balance dropped accordingly; if you dispute that debt, respond to the agency that holds it.`
            : hasTranscript ? `Match the transcript's transaction codes against the missing ${usd(diff)} — or have a professional confirm the reading.` : `Download your ${yearText} Account Transcript (instant from your IRS online account) and add it here — it answers this finding and strengthens every other one in this case.` },
      ],
    });
  } else if (/refund/.test(lower)) {
    const guidance = evidenceGuidance(primaryYear);
    const classified = [expectedRefund?.amount, receivedRefund?.amount, balanceDue?.amount].filter(Boolean) as number[];
    const stray = fromNarrative.mentions.map((m) => m.amount).filter((a) => !classified.includes(a));
    issues.push({
      issue_type: "refund_discrepancy",
      item_kind: "missing_info",
      evidence_status: "possible",
      evidence_strength: "limited",
      tax_year: primaryYear,
      title: `Possible ${primaryYear ? `${primaryYear} ` : ""}refund issue — two figures pin it down`,
      what_we_know: `You raised a refund concern${primaryYear ? ` for tax year ${primaryYear}` : ""}${hasDocs ? `, and ${docs.length} supporting document${docs.length === 1 ? " is" : "s are"} on file` : ""}.${stray.length ? ` You mentioned ${stray.map(usd).join(" and ")} — telling us exactly what ${stray.length === 1 ? "that figure refers" : "those figures refer"} to (expected refund, amount received, or something else) lets us compute the gap immediately.` : ""} For context: the IRS issues most e-filed refunds within 21 days of acceptance — when one doesn't arrive in full, the difference is an offset (TC 826), an adjustment (CP12-type notice), or a review hold (TC 570), and each has a defined remedy.`,
      our_conclusion: expectedRefund
        ? `We have one side of the equation (${usd(expectedRefund.amount)} expected) — the amount actually received is the single missing number. Answer the questions below or add your transcript and this becomes a computed finding.`
        : "Two numbers unlock this finding: the refund your return claimed (Form 1040, line 35a) and the amount that actually arrived. Answer the questions below — it takes under a minute — or add your tax return and Account Transcript and we'll extract them.",
      still_unclear: [
        `The refund amount your ${yearText} return claimed (Form 1040, line 35a)`,
        "The amount actually issued, and the date it arrived (bank record or transcript TC 846)",
        "When you filed — refunds normally issue within 21 days of e-file acceptance, so the timeline tells us if something intervened",
        "Whether an offset, adjustment, or hold caused any difference (your Account Transcript shows this code by code)",
      ],
      explanations: [
        { title: "Refund offset", detail: "Part or all of the refund was applied to another debt — a prior tax year, state taxes, child support, or federal student loans (TC 826 or a Treasury Offset notice).", likelihood: "Possible" },
        { title: "IRS adjustment", detail: "The IRS corrected the return (math errors, credit changes) and refunded a different amount — a CP12-type notice normally follows.", likelihood: "Possible" },
        { title: "Refund hold or review", detail: "The refund (or part of it) is held pending review (TC 570) and may still be released.", likelihood: "Possible" },
      ],
      confidence: "low",
      priority: "medium",
      state: guidance.state,
      next_action: guidance.action,
      alternative_action: "Answer the quick questions on this page — each answer updates this analysis immediately.",
      analysis_outline: [
        { heading: "Your situation", detail: `You raised a refund concern${primaryYear ? ` for ${yearText}` : ""}, but the expected and received amounts weren't both stated, so the gap can't be computed yet.${stray.length ? ` The figure${stray.length === 1 ? "" : "s"} ${stray.map(usd).join(", ")} in your summary couldn't be classified with certainty — the questions below resolve that.` : ""}` },
        { heading: "Tax rules", detail: `Rule: e-filed refunds normally issue within 21 days of acceptance; when the amount differs from the return, IRS procedure allows exactly three causes — offset (TC 826), adjustment (CP12-type notices), or review hold (TC 570). Why it matters to your case: all three are visible on your Account Transcript, so the exact cause is establishable from one free document.`, source: "IRS refund timing guidance · Account Transcript transaction codes (TC 846, TC 826, TC 570) · CP12 notice guidance" },
        { heading: "Your evidence", detail: evidenceLine() },
        { heading: "Our conclusion", detail: "A refund issue is possible but not yet established — and it is fully establishable: two numbers plus one document turn this into a computed, verified finding with a dollar figure and a specific cause." },
        { heading: "Your next move", detail: `Fastest: answer the questions on this page (under a minute). Strongest: add your ${yearText} tax return and Account Transcript — we extract the numbers and match them against the transcript's transaction codes.` },
      ],
    });
  }

  // ---------- Balance due ----------
  if (balanceDue) {
    const balanceFromTranscript = transcript.accountBalance !== null && transcript.accountBalance > 0;
    issues.push({
      issue_type: "balance_due",
      item_kind: "issue",
      evidence_status: balanceFromTranscript ? "confirmed" : balanceDue.fromDocument ? "likely" : "possible",
      evidence_strength: balanceFromTranscript ? "strong" : balanceDue.fromDocument ? "moderate" : hasTranscript ? "moderate" : "limited",
      tax_year: primaryYear,
      expected_amount: balanceDue.amount,
      title: balanceFromTranscript ? `Balance due confirmed — ${usd(balanceDue.amount)}` : `Possible balance due of ${usd(balanceDue.amount)}`,
      what_we_know: `${balanceFromTranscript ? "Your IRS Account Transcript shows an account balance of" : balanceDue.fromDocument ? "Your uploaded records show" : "Your information mentions"} ${usd(balanceDue.amount)}${balanceFromTranscript ? " — the IRS's own current figure" : " owed to the IRS"}${primaryYear ? ` for tax year ${primaryYear}` : ""}.${transcript.penalties.length ? ` Of that, ${usd(transcript.penalties.reduce((s, p) => s + Math.abs(p.amount), 0))} is penalties/interest per the transcript — some penalties may be eligible for relief depending on the circumstances.` : ""} Depending on your balance and circumstances, you may have several payment or collection-resolution options, and some penalties may be eligible for relief under applicable IRS rules.`,
      our_conclusion: `A balance of about ${usd(balanceDue.amount)} appears to exist, but its composition (tax vs. penalties vs. interest) and current status aren't established yet — and that composition determines which resolution options apply.`,
      still_unclear: [
        "The current confirmed balance (it changes with penalties and interest)",
        "How much is tax principal versus penalties versus interest",
        "Payments or credits already applied",
        "Whether the balance is under active collection",
        "Whether the IRS has made a recent adjustment",
      ],
      confidence: "medium",
      priority: "high",
      state: hasTranscript ? "review" : "action_needed",
      next_action: hasTranscript ? "REVIEW" : "GET_TRANSCRIPT",
      alternative_action: "Have a TaxOnMe professional evaluate the resolution options with you.",
      analysis_outline: [
        { heading: "Your situation", detail: `${balanceDue.fromDocument ? "Your uploaded records show" : "You reported"} ${usd(balanceDue.amount)} owed to the IRS${primaryYear ? ` for ${yearText}` : ""}.` },
        { heading: "Tax rules", detail: `Rule: an IRS balance is made of tax + penalties + interest, and each part is treated differently. Why it matters to your case: installment agreements are defined by law (IRC §6159) with streamlined thresholds, some penalties may be eligible for relief depending on your compliance history, and interest follows the balance — so confirming the composition can change both the amount and the options.`, source: "IRC §6159 · Form 9465 instructions · IRM 20.1.1 (penalty relief)" },
        { heading: "Your evidence", detail: evidenceLine() },
        { heading: "Our conclusion", detail: `The balance is ${balanceDue.fromDocument ? "supported by your records" : "reported but not yet documented"}. Once the Account Transcript and any IRS notice confirm the amount and its composition, TaxOnMe can evaluate the legitimate resolution paths for your circumstances.` },
        { heading: "Your next move", detail: hasTranscript ? `Your transcript is on file — confirm the tax/penalty/interest split from its codes, then use the Form 9465 wizard to prepare a payment plan request if needed.` : `Add your ${yearText} Account Transcript and the IRS notice showing the balance — together they confirm the exact amount so the resolution can be sized correctly.` },
      ],
    });
  } else if (/(owe|balance|debt|amount due)/.test(lower)) {
    const guidance = evidenceGuidance(primaryYear);
    issues.push({
      issue_type: "balance_due",
      item_kind: "missing_info",
      evidence_status: "needs_verification",
      evidence_strength: "limited",
      tax_year: primaryYear,
      title: `Possible ${primaryYear ? `${primaryYear} ` : ""}balance due — one figure unlocks the options`,
      what_we_know: `We found evidence that you may have an IRS balance${primaryYear ? ` for tax year ${primaryYear}` : ""}, but the available information does not yet establish the current amount.${hasDocs ? ` ${docs.length} document${docs.length === 1 ? " is" : "s are"} on file with information relevant to the balance.` : ""} The amount matters because the resolution thresholds are specific: balances of $50,000 or less generally qualify for a streamlined monthly installment agreement (no financial statement), and up to $100,000 can get a 180-day short-term plan.`,
      our_conclusion: "A balance may exist, but until the amount and its composition (tax vs. penalties vs. interest) are established, no resolution option can responsibly be recommended. One number from your IRS notice or online account — given in the questions below — moves this forward immediately.",
      still_unclear: [
        "The current balance (it grows with penalties and interest until arranged)",
        "Which notice/letter states it, its date, and any respond-by deadline printed on it",
        "Tax principal versus penalties versus interest — penalties may be relievable, interest is statutory",
        "Payments or credits already applied",
        "Whether the balance is under active collection (that changes the urgency)",
      ],
      explanations: [
        { title: "Filed but couldn't pay in full", detail: "The most common case — the balance is real and payment options (installment agreement, short-term plan) are the path.", likelihood: "Possible" },
        { title: "IRS adjustment or proposed change", detail: "A CP2000-type proposal or correction — these can be agreed with, partially agreed, or disputed in writing before the deadline.", likelihood: "Possible" },
        { title: "Penalties and interest inflating the base tax", detail: "Part of the balance may be relievable penalties (e.g. first-time abatement) rather than tax.", likelihood: "Possible" },
      ],
      confidence: "low",
      priority: "medium",
      state: guidance.state,
      next_action: guidance.action,
      alternative_action: "Answer the quick questions on this page — the balance amount alone sharpens every recommendation.",
      analysis_outline: [
        { heading: "Your situation", detail: "You reported owing the IRS, but the exact amount wasn't stated — so the right resolution path can't be sized yet." },
        { heading: "Tax rules", detail: "Rule: resolution options are amount-driven — full payment, streamlined installment agreements under IRC §6159 (≤ $50,000), 180-day plans (≤ $100,000), or hardship status. Why it matters to your case: the facts must be established before the right option can be identified — deciding the solution before the facts is how taxpayers end up on the wrong plan.", source: "IRC §6159 · Form 9465 instructions · IRS collection procedures" },
        { heading: "Your evidence", detail: evidenceLine() },
        { heading: "Our conclusion", detail: "The concern is credible but unverified. The IRS notice (or your online account balance) establishes the amount; the Account Transcript establishes its composition — together they let TaxOnMe evaluate the legitimate resolution paths for your circumstances." },
        { heading: "Your next move", detail: "Fastest: answer the questions on this page with the amount from your notice. Strongest: upload the notice and your Account Transcript — we verify the amount and split it into tax, penalties, and interest." },
      ],
    });
  }

  // ---------- Notice-specific issues, grounded in the knowledge base ----------
  for (const code of noticeCodes) {
    const kb = await db.knowledgeSource.findFirst({
      where: { reference: { contains: code }, isActive: true },
    });
    const hasNoticeDoc = haveKinds.has("notice");
    const urgent = code.startsWith("LT");
    issues.push({
      issue_type: "notice_response",
      item_kind: urgent ? "risk" : "issue",
      evidence_status: kb ? "likely" : "possible",
      evidence_strength: hasNoticeDoc ? "moderate" : "limited",
      tax_year: primaryYear,
      title: `IRS notice ${code}`,
      what_we_know: kb
        ? `${kb.title}: ${kb.content.slice(0, 400)}${kb.content.length > 400 ? "…" : ""}`
        : `You mentioned notice ${code}. Upload the notice itself so we can confirm its type, amount, and response deadline.`,
      our_conclusion: urgent
        ? `${code} is a final collection notice — the response window protects your appeal rights, so the printed deadline should be treated as hard.`
        : `Notice ${code} defines what the IRS wants and by when. ${hasNoticeDoc ? "The notice is on file; its printed deadline and amount govern the response." : "Uploading the notice pins down the deadline and amount that govern the response."}`,
      still_unclear: [
        hasNoticeDoc ? "The response deadline printed on your copy (top right) — confirm and add it to your deadlines" : "The exact deadline printed on your copy of the notice",
        "Whether you agree, partially agree, or disagree with what the notice states",
      ],
      confidence: kb ? "medium" : "low",
      priority: urgent ? "urgent" : "high",
      state: urgent ? "urgent" : "action_needed",
      next_action: "DRAFT_LETTER",
      alternative_action: hasNoticeDoc ? "" : "Photograph and upload the notice — its number, amount, and deadline are printed on it.",
      irs_basis: kb ? kb.reference : "",
      analysis_outline: [
        { heading: "Your situation", detail: `You referenced IRS notice ${code}${primaryYear ? ` for ${yearText}` : ""}. Notice types define exactly what the IRS wants and by when — identifying the code already tells us most of the story.` },
        { heading: "Tax rules", detail: kb ? `Rule: ${kb.content.slice(0, 450)} Why it matters to your case: the notice's printed deadline and stated amount govern your response options.` : `This notice code isn't in our reference library yet — the notice document itself will establish its type, amount, and deadline.`, source: kb ? kb.reference : "" },
        { heading: "Your evidence", detail: hasNoticeDoc ? "The notice itself is on file — good. Its printed deadline and amount govern the response." : "The notice document isn't uploaded yet. A phone photo is enough — the notice number, amount, and deadline are printed on it." },
        { heading: "Our conclusion", detail: `${urgent ? "This is a FINAL collection notice — the response window (usually 30 days) protects your appeal rights, so treat the deadline as hard." : "You can agree, partially agree, or disagree."} Disagreement must be in writing before the deadline, with supporting documents attached.` },
        { heading: "Your next move", detail: hasNoticeDoc ? "Draft your response letter now, attach your supporting documents, and mail before the printed deadline (certified mail recommended)." : "Photograph and upload the notice, confirm the deadline into your reminders, then draft the response letter." },
      ],
    });
  }

  // ---------- Penalty relief (an OPPORTUNITY, not a promise) ----------
  if (/(penalt|interest)/.test(lower)) {
    issues.push({
      issue_type: "penalty",
      item_kind: "opportunity",
      evidence_status: "possible",
      evidence_strength: hasTranscript ? "moderate" : "limited",
      tax_year: primaryYear,
      title: "Penalty relief may be available",
      what_we_know: "Your situation mentions penalties or interest. Some penalties may be eligible for relief depending on the circumstances and applicable IRS rules — first-time abatement applies when the prior three years are penalty-clean, and reasonable-cause relief is a separate path. Relief is requested in writing; we can draft the request letter for you.",
      our_conclusion: "Relief eligibility can't be assessed until the assessed penalties and your compliance history are established — both appear on your Account Transcript.",
      still_unclear: [
        "Which penalties were assessed (the transcript lists them by transaction code, e.g. TC 276)",
        "Your compliance history for the prior three years",
        "Whether reasonable-cause circumstances apply (illness, disaster, reliance on advice)",
      ],
      confidence: "medium",
      priority: "medium",
      state: "review",
      next_action: hasTranscript ? "DRAFT_LETTER" : "GET_TRANSCRIPT",
      alternative_action: "Have a TaxOnMe professional assess your eligibility.",
      analysis_outline: [
        { heading: "Your situation", detail: "Your situation mentions penalties or interest on top of the tax itself." },
        { heading: "Tax rules", detail: "Rule: first-time abatement removes failure-to-file and failure-to-pay penalties when (1) the prior 3 years are penalty-clean, (2) all required returns are filed, and (3) the tax is paid or on a payment plan; reasonable cause is a second path. Why it matters to your case: if eligible, the penalty portion of your balance may be removable with one written request — and interest on abated penalties is removed with them.", source: "IRM 20.1.1.3.3.2.1 (first-time abatement) · reasonable-cause criteria" },
        { heading: "Your evidence", detail: evidenceLine() },
        { heading: "Our conclusion", detail: "This is an opportunity, not a promise: eligibility depends on facts that your Account Transcript establishes. If the criteria are met, relief is a defined administrative process." },
        { heading: "Your next move", detail: hasTranscript ? "Your transcript shows which penalties were assessed — draft the relief request letter and send it with any response form." : "Get your Account Transcript to see exactly which penalties were assessed, then we draft the relief request." },
      ],
    });
  }

  // ---------- Unfiled returns (a RISK) ----------
  if (/(didn'?t file|not filed|unfiled|late filing|missed filing|never filed)/.test(lower)) {
    issues.push({
      issue_type: "missing_return",
      item_kind: "risk",
      evidence_status: "possible",
      evidence_strength: "limited",
      tax_year: primaryYear,
      title: "Possible unfiled return",
      what_we_know: "Unfiled returns usually must be filed before other resolutions (payment plans, penalty relief) become available. The IRS may file a 'substitute for return' on your behalf that overstates what you owe.",
      our_conclusion: "Until the unfiled years are identified and filed, most resolution options stay locked — and any IRS-prepared substitute return likely overstates the true tax.",
      still_unclear: [
        "Which years are unfiled",
        "Whether the IRS has already filed a substitute return for any year",
        "The income the IRS has on file for those years (wage & income transcripts show this)",
      ],
      confidence: "medium",
      priority: "high",
      state: "action_needed",
      next_action: "GET_TRANSCRIPT",
      alternative_action: "Have a TaxOnMe professional reconstruct the filings with you.",
      analysis_outline: [
        { heading: "Your situation", detail: "Your situation involves one or more unfiled tax returns." },
        { heading: "Tax rules", detail: "Rule: if you don't file, the IRS may file FOR you — a Substitute for Return (IRC §6020(b)) with the worst assumptions: single status, no deductions, no credits. Why it matters to your case: filing your own accurate return replaces it and usually lowers the bill; IRS policy generally requires the last 6 years of returns for compliance; and refunds are only payable within 3 years of the due date — late filing can forfeit money you're owed.", source: "IRC §6020(b) · IRS Policy Statement 5-133 · refund statute of limitations" },
        { heading: "Your evidence", detail: evidenceLine() },
        { heading: "Our conclusion", detail: "Filing the missing returns typically reduces any substitute-return assessment, restores eligibility for payment plans and penalty relief, and stops the largest penalty type from compounding." },
        { heading: "Your next move", detail: "Get your Wage & Income Transcripts — they list every W-2/1099 the IRS received, letting you reconstruct income for the unfiled years even if you lost the paperwork." },
      ],
    });
  }

  if (issues.length === 0) {
    const guidance = evidenceGuidance(primaryYear);
    issues.push({
      issue_type: "other",
      item_kind: "missing_info",
      evidence_status: "needs_verification",
      evidence_strength: "limited",
      title: "Tax situation review",
      what_we_know: `We recorded your summary and goal${hasDocs ? ` and ${docs.length} document${docs.length === 1 ? "" : "s"}` : ""}.`,
      our_conclusion: "Nothing matched a specific issue pattern yet — which often just means the detail lives in the documents.",
      still_unclear: [guidance.what],
      confidence: "low",
      priority: "medium",
      state: guidance.state,
      next_action: guidance.action,
      alternative_action: "",
      analysis_outline: [
        { heading: "Your situation", detail: "We recorded your summary and goal. Nothing in it matched a specific issue pattern yet — which often just means the detail lives in the documents." },
        { heading: "Tax rules", detail: "Every taxpayer situation resolves through the same fundamentals: confirm what the IRS has on file (transcripts), compare it with your records, respond to any notices in writing before their deadlines, and use the defined relief paths where they apply.", source: "IRS transcript and notice-response procedures" },
        { heading: "Your evidence", detail: evidenceLine() },
        { heading: "Our conclusion", detail: "There isn't enough information for a specific finding yet — the documents will drive the next pass." },
        { heading: "Your next move", detail: "Add your documents — notices, returns, transcripts. Each upload re-runs this analysis and sharpens the results automatically." },
      ],
    });
  }

  // ---------- Path forward ----------
  const pathSteps: FallbackResult["pathSteps"] = [];
  pathSteps.push({
    title: hasDocs ? `Add any remaining documents (${docs.length} on file)` : "Add your supporting documents",
    description: hasDocs
      ? "You've started your evidence file — add anything still missing (see the 'Documents we still need' checklist)."
      : "Upload the IRS notice, your tax return, and any W-2/1099s. Completes automatically when your case has documents.",
    action_key: "UPLOAD_DOCUMENTS",
  });
  if (!hasTranscript) {
    pathSteps.push({
      title: "Get your IRS account transcript",
      description: "Your transcript shows exactly what the IRS has on file — including where any missing refund went. Completes when a transcript is in your case documents.",
      action_key: "GET_TRANSCRIPT",
    });
  }
  pathSteps.push({
    title: "Re-run the analysis with your documents",
    description: "Once documents are in, re-run the analysis so every amount is verified against them.",
    action_key: "REVIEW_ANALYSIS",
  });
  if (noticeCodes.length > 0) {
    pathSteps.push({
      title: "Draft your response letter",
      description: "If you disagree with a notice, the IRS expects a written response with your supporting documents. Generate a professional reply, edit it, and mail it before the deadline. Completes when a letter exists.",
      action_key: "DRAFT_LETTER",
    });
  }
  if (/(penalt|interest)/.test(lower)) {
    pathSteps.push({
      title: "Request penalty relief in writing",
      description: "If you're eligible, relief is requested with a short letter (we draft it) or by calling the IRS. Send it together with any response form from your notice.",
      action_key: "DRAFT_LETTER",
    });
  }
  if (/(payment plan|installment|can'?t pay|afford)/.test(lower) || balanceDue) {
    pathSteps.push({
      title: "Prepare a payment plan request (Form 9465)",
      description: "Use the guided form wizard to prepare an installment agreement request. Mail it with your notice's response slip, or apply online for faster setup. Completes when the form is finished.",
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
    amounts_mentioned: fromNarrative.mentions.map((m) => m.amount),
    transcript_transactions: transcript.transactions.slice(0, 25),
    transcript_account_balance: transcript.accountBalance,
    user_goal: goal,
    unknowns: issues.flatMap((i) => (Array.isArray(i.still_unclear) ? (i.still_unclear as string[]).slice(0, 1) : [])),
  };

  return { facts, issues, pathSteps, conflicts };
}
