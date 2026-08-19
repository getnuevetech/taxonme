// Deterministic arithmetic. Whether A - B = C is a calculation, not a judgement
// call, so it is computed in code and recorded as SYSTEM_CALCULATED rather than
// asked of a model.

export const AMOUNT_TOLERANCE = 0.01;

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function amountsEqual(a: number, b: number, tolerance = AMOUNT_TOLERANCE): boolean {
  return Math.abs(roundCents(a) - roundCents(b)) <= tolerance;
}

export function sumAmounts(values: (number | null | undefined)[]): number {
  return roundCents(values.reduce<number>((total, value) => total + (typeof value === "number" && Number.isFinite(value) ? value : 0), 0));
}

export type Calculation = {
  calculationId: string;
  expression: string;
  inputs: { label: string; value: number }[];
  result: number;
  balanced: boolean;
};

// overpayment - transfers = refund issued
export function reconcileRefundArithmetic(input: {
  overpayment: number;
  transfersOut: number;
  refundIssued: number;
}): Calculation {
  const expected = roundCents(input.overpayment - Math.abs(input.transfersOut));
  return {
    calculationId: "refund_reconciliation",
    expression: "overpayment - transfers_out = refund_issued",
    inputs: [
      { label: "overpayment", value: roundCents(input.overpayment) },
      { label: "transfers_out", value: roundCents(Math.abs(input.transfersOut)) },
      { label: "refund_issued", value: roundCents(Math.abs(input.refundIssued)) },
    ],
    result: expected,
    balanced: amountsEqual(expected, Math.abs(input.refundIssued)),
  };
}

export type PeriodEvent = {
  eventType: string;
  amount: number | null;
  eventDate?: Date | null;
  taxPeriod?: string | null;
};

// Per-period totals derived from the event ledger. Signs are normalized to
// magnitudes so unrelated transcript conventions cannot flip a comparison.
export function computePeriodTotals(events: PeriodEvent[]) {
  const magnitude = (event: PeriodEvent) => Math.abs(event.amount ?? 0);
  const byType = (type: string) => events.filter((event) => event.eventType === type);
  return {
    assessed: sumAmounts(byType("RETURN_FILED").map(magnitude)),
    payments: sumAmounts(byType("PAYMENT_RECEIVED").map(magnitude)),
    credits: sumAmounts(byType("WITHHOLDING_CREDIT").map(magnitude)),
    transfersOut: sumAmounts(byType("CREDIT_TRANSFERRED_OUT").map(magnitude)),
    transfersIn: sumAmounts(byType("CREDIT_TRANSFERRED_IN").map(magnitude)),
    refunds: sumAmounts(byType("REFUND_ISSUED").map(magnitude)),
    penalties: sumAmounts(byType("PENALTY_OR_INTEREST_ASSESSED").map(magnitude)),
  };
}
