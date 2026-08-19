/**
 * A response letter goes to the IRS over the customer's name. A figure invented
 * or misremembered by a model becomes the customer's own written assertion, so
 * every dollar amount in a draft is checked against the evidence before the
 * draft is ever shown.
 */
const AMOUNT_PATTERN = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;

function toCents(value: number): number {
  return Math.round(value * 100);
}

export function statedAmounts(letterText: string): number[] {
  const found: number[] = [];
  for (const match of letterText.matchAll(AMOUNT_PATTERN)) {
    const parsed = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(parsed)) found.push(parsed);
  }
  return found;
}

/**
 * Amounts are compared by absolute value: a transcript records a refund as a
 * credit while a letter refers to the same refund as a positive sum, and that
 * sign difference is presentation, not a contradiction.
 */
export function unsupportedAmounts(letterText: string, statableAmounts: number[]): number[] {
  const supported = new Set(statableAmounts.map((v) => toCents(Math.abs(v))));
  const unsupported: number[] = [];
  for (const amount of statedAmounts(letterText)) {
    if (supported.has(toCents(Math.abs(amount)))) continue;
    if (unsupported.includes(amount)) continue;
    unsupported.push(amount);
  }
  return unsupported;
}

export function letterCorrectionInstruction(unsupported: number[]): string {
  const list = unsupported.map((v) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}`).join(", ");
  return (
    `The draft states ${list}, which the evidence on file does not establish. ` +
    "Remove every figure that is not listed in the established evidence. " +
    "Where an amount is needed but not established, describe what is being asked for in words instead of stating a number."
  );
}
