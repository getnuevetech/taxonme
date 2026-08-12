import "server-only";
import { db } from "./db";
import { formatCaseNumber } from "./case-number";
import type { WizardStep } from "@/actions/forms";

export type KnownFact = { label: string; value: string };
export type FormPrefill = {
  // Values keyed by wizard field key, already validated against the template.
  values: Record<string, string>;
  // Everything we know, for the copy-panel next to the form.
  facts: KnownFact[];
  caseNumber: string | null;
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

// Older analyses stored amounts only in the issue text ("Possible balance due
// of $2,800.00") — recover them so prefill works for those cases too.
function amountFromText(text: string): number | null {
  const m = text.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Builds prefill values + a "what we already know" fact sheet for a form,
 * from the customer's profile and the analyzed data of their most recent case
 * (extracted facts, issues, notices, deadlines). Field keys follow the
 * conventions used by the seeded templates; admin-created templates that use
 * the same keys (name, ssn, address, phone, tax_years, amount_owed, ...) are
 * prefilled automatically.
 */
export async function buildFormPrefill(userId: string, steps: WizardStep[]): Promise<FormPrefill> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true, phone: true, address: true, idNumber: true },
  });
  const kase = await db.case.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: {
      issues: true,
      notices: true,
      deadlines: { where: { status: "open" }, orderBy: { dueDate: "asc" }, take: 1 },
      runs: {
        where: { status: "complete" },
        orderBy: { startedAt: "desc" },
        take: 8,
        include: { consensus: true },
      },
    },
  });

  // Merged facts from the most recent analysis run that produced them.
  let merged: Record<string, unknown> = {};
  for (const run of kase?.runs ?? []) {
    try {
      const parsed = JSON.parse(run.consensus?.mergedJson || "{}");
      if (parsed && (parsed.tax_years || parsed.balance_due || parsed.expected_refund || parsed.notices_received)) {
        merged = parsed;
        break;
      }
    } catch { /* skip unparseable runs */ }
  }

  // ---- Derive the knowledge base ----
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  const yearSet = new Set<number>();
  if (Array.isArray(merged.tax_years)) for (const y of merged.tax_years) if (typeof y === "number") yearSet.add(y);
  for (const i of kase?.issues ?? []) if (i.taxYear) yearSet.add(i.taxYear);
  for (const n of kase?.notices ?? []) if (n.taxYear) yearSet.add(n.taxYear);
  const years = Array.from(yearSet).sort();
  const yearsText = years.join(", ");

  const noticeSet = new Set<string>();
  if (Array.isArray(merged.notices_received)) for (const n of merged.notices_received) if (typeof n === "string" && n) noticeSet.add(n);
  for (const n of kase?.notices ?? []) if (n.noticeType) noticeSet.add(n.noticeType);
  const notices = Array.from(noticeSet);

  const balanceIssue = kase?.issues.find((i) => i.issueType === "balance_due");
  const noticeAmount = (kase?.notices ?? []).map((n) => (n.amountCents ? n.amountCents / 100 : 0)).find((a) => a > 0) ?? null;
  const balanceDue =
    num(merged.balance_due) ??
    (balanceIssue?.expectedCents ? balanceIssue.expectedCents / 100 : null) ??
    (balanceIssue?.differenceCents ? balanceIssue.differenceCents / 100 : null) ??
    (balanceIssue ? amountFromText(balanceIssue.title) ?? amountFromText(balanceIssue.description) : null) ??
    noticeAmount;

  const refundIssue = kase?.issues.find((i) => i.issueType === "refund_discrepancy");
  const expectedRefund = num(merged.expected_refund) ?? (refundIssue?.expectedCents ? refundIssue.expectedCents / 100 : null);
  const receivedRefund = num(merged.received_refund) ?? (refundIssue?.receivedCents ? refundIssue.receivedCents / 100 : null);
  const refundDifference =
    (refundIssue?.differenceCents ? refundIssue.differenceCents / 100 : null) ??
    (expectedRefund !== null && receivedRefund !== null ? Math.round((expectedRefund - receivedRefund) * 100) / 100 : null);

  // IRS generally accepts balance ÷ 72 as the minimum streamlined monthly payment.
  const suggestedMonthly = balanceDue ? Math.ceil(balanceDue / 72) : null;
  const nextDeadline = kase?.deadlines[0] ?? null;

  // ---- Candidate values by field-key convention ----
  const primaryYear = years.length ? String(years[years.length - 1]) : "";
  const moneyStr = (n: number | null) => (n === null ? "" : String(Math.round(n * 100) / 100));
  const candidates: Record<string, string> = {
    name: fullName,
    full_name: fullName,
    first_name: user?.firstName ?? "",
    last_name: user?.lastName ?? "",
    ssn: user?.idNumber ?? "",
    tin: user?.idNumber ?? "",
    id_number: user?.idNumber ?? "",
    address: user?.address ?? "",
    current_address: user?.address ?? "",
    mailing_address: user?.address ?? "",
    phone: user?.phone ?? "",
    phone_number: user?.phone ?? "",
    daytime_phone: user?.phone ?? "",
    email: user?.email ?? "",
    tax_form: kase ? "Form 1040" : "",
    tax_year: primaryYear,
    tax_years: yearsText,
    years: yearsText,
    amount_owed: moneyStr(balanceDue),
    amount_due: moneyStr(balanceDue),
    balance_due: moneyStr(balanceDue),
    total_owed: moneyStr(balanceDue),
    monthly_payment: suggestedMonthly === null ? "" : String(suggestedMonthly),
    expected_refund: moneyStr(expectedRefund),
    received_refund: moneyStr(receivedRefund),
    refund_difference: moneyStr(refundDifference),
    notice_number: notices.join(", "),
    notice_type: notices.join(", "),
  };

  // Only keep values that fit the template: known field keys, and for
  // select/boolean fields only values that match an actual option.
  const values: Record<string, string> = {};
  for (const step of steps) {
    for (const field of step.fields) {
      const candidate = candidates[field.key];
      if (!candidate) continue;
      if (field.type === "select") {
        if ((field.options ?? []).some((o) => o.value === candidate)) values[field.key] = candidate;
      } else if (field.type === "boolean") {
        if (candidate === "Yes" || candidate === "No") values[field.key] = candidate;
      } else {
        values[field.key] = candidate;
      }
    }
  }

  // ---- Fact sheet for the copy panel ----
  const facts: KnownFact[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) facts.push({ label, value });
  };
  add("Your name", fullName);
  add("Address", user?.address);
  add("Phone", user?.phone);
  add("Email", user?.email);
  add("ID number on file", user?.idNumber);
  if (kase) {
    add("Case", `${formatCaseNumber(kase.number)} — ${kase.title.slice(0, 60)}`);
    add("Tax year(s)", yearsText);
    add("IRS notice(s)", notices.join(", "));
    add("Balance owed (from analysis)", balanceDue === null ? "" : usd(balanceDue));
    add("Expected refund", expectedRefund === null ? "" : usd(expectedRefund));
    add("Refund received", receivedRefund === null ? "" : usd(receivedRefund));
    add("Refund difference", refundDifference === null ? "" : usd(refundDifference));
    add("Suggested monthly payment (balance ÷ 72)", suggestedMonthly === null ? "" : usd(suggestedMonthly));
    add("Next deadline", nextDeadline ? `${nextDeadline.title} — ${nextDeadline.dueDate.toLocaleDateString("en-US")}` : "");
    add("Your goal", kase.goal?.slice(0, 120));
  }

  return { values, facts, caseNumber: kase ? formatCaseNumber(kase.number) : null };
}
