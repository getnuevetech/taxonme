import { amountsEqual, computePeriodTotals, reconcileRefundArithmetic, roundCents, type Calculation } from "./calculations";
import { FACT_KEYS, PROVENANCE } from "./types";

// Cross-document and cross-period reconciliation. This is a matching problem
// over the stored ledgers, so it runs in code: a credit that leaves one period
// and arrives in another is found by comparing rows, not by hoping a model
// notices it.

export type LedgerEvent = {
  id: string;
  taxPeriod: string;
  eventType: string;
  amount: number | null;
  eventDate: Date | null;
};

export type LedgerFact = {
  id: string;
  factKey: string;
  taxPeriod: string;
  valueNumber: number | null;
  effectiveDate: Date | null;
  provenance: string;
  documentId?: string | null;
};

export type RelationshipInput = {
  relationshipType: string;
  fromTaxPeriod: string;
  toTaxPeriod: string;
  amount: number | null;
  status: "CONFIRMED" | "POSSIBLE" | "REJECTED";
  description: string;
  supportingFactIds: string[];
};

export type ReconciliationResult = {
  relationships: RelationshipInput[];
  calculations: Calculation[];
  supersededFactIds: string[];
  currentBalanceByPeriod: Record<string, { factId: string; value: number; asOf: Date | null }>;
};

function periodsOf(events: LedgerEvent[], facts: LedgerFact[]): string[] {
  return Array.from(new Set([...events.map((e) => e.taxPeriod), ...facts.map((f) => f.taxPeriod)].filter(Boolean)));
}

export function analyzeEvidenceRelationships(events: LedgerEvent[], facts: LedgerFact[]): ReconciliationResult {
  const relationships: RelationshipInput[] = [];
  const calculations: Calculation[] = [];
  const supersededFactIds: string[] = [];
  const currentBalanceByPeriod: ReconciliationResult["currentBalanceByPeriod"] = {};

  // A credit that left one period should arrive in another.
  const transfersOut = events.filter((e) => e.eventType === "CREDIT_TRANSFERRED_OUT");
  const transfersIn = events.filter((e) => e.eventType === "CREDIT_TRANSFERRED_IN");
  const claimedIn = new Set<string>();
  for (const out of transfersOut) {
    const magnitude = Math.abs(out.amount ?? 0);
    if (magnitude === 0) continue;
    const match = transfersIn.find(
      (candidate) =>
        !claimedIn.has(candidate.id) &&
        candidate.taxPeriod !== out.taxPeriod &&
        amountsEqual(Math.abs(candidate.amount ?? 0), magnitude),
    );
    if (match) {
      claimedIn.add(match.id);
      relationships.push({
        relationshipType: "CROSS_PERIOD_TRANSFER",
        fromTaxPeriod: out.taxPeriod,
        toTaxPeriod: match.taxPeriod,
        amount: roundCents(magnitude),
        status: "CONFIRMED",
        description: `A credit of ${magnitude} left ${out.taxPeriod || "an earlier period"} and was applied to ${match.taxPeriod || "another period"}.`,
        supportingFactIds: [out.id, match.id],
      });
      continue;
    }
    relationships.push({
      relationshipType: "CREDIT_TRANSFERRED_OUT_UNMATCHED",
      fromTaxPeriod: out.taxPeriod,
      toTaxPeriod: "",
      amount: roundCents(magnitude),
      status: "POSSIBLE",
      description: `A credit of ${magnitude} left ${out.taxPeriod || "this period"}; the receiving period is not established by the available records.`,
      supportingFactIds: [out.id],
    });
  }

  // Refund arithmetic is checked, never guessed.
  for (const period of periodsOf(events, facts)) {
    const periodEvents = events.filter((e) => e.taxPeriod === period);
    const totals = computePeriodTotals(periodEvents);
    if (totals.refunds === 0 && totals.transfersOut === 0) continue;
    const overpayment = roundCents(totals.credits + totals.payments - totals.assessed);
    if (overpayment <= 0) continue;
    const calculation = reconcileRefundArithmetic({
      overpayment,
      transfersOut: totals.transfersOut,
      refundIssued: totals.refunds,
    });
    calculations.push({ ...calculation, calculationId: `refund_reconciliation:${period}` });
    relationships.push({
      relationshipType: "REFUND_RECONCILIATION",
      fromTaxPeriod: period,
      toTaxPeriod: period,
      amount: roundCents(totals.refunds),
      status: calculation.balanced ? "CONFIRMED" : "POSSIBLE",
      description: calculation.balanced
        ? `The refund issued for ${period} equals the overpayment less the credit transferred out.`
        : `The refund issued for ${period} does not yet reconcile with the recorded overpayment and transfers.`,
      supportingFactIds: periodEvents.map((e) => e.id),
    });
  }

  // An older balance and a newer balance are a sequence, not a contradiction.
  for (const period of periodsOf(events, facts)) {
    const balances = facts
      .filter((f) => f.factKey === FACT_KEYS.ACCOUNT_BALANCE && f.taxPeriod === period && typeof f.valueNumber === "number")
      .sort((a, b) => (a.effectiveDate?.getTime() ?? 0) - (b.effectiveDate?.getTime() ?? 0));
    if (balances.length === 0) continue;
    const current = balances[balances.length - 1];
    currentBalanceByPeriod[period] = {
      factId: current.id,
      value: current.valueNumber as number,
      asOf: current.effectiveDate ?? null,
    };
    for (const older of balances.slice(0, -1)) {
      supersededFactIds.push(older.id);
      if (!amountsEqual(older.valueNumber as number, current.valueNumber as number)) {
        relationships.push({
          relationshipType: "BALANCE_SUPERSEDED",
          fromTaxPeriod: period,
          toTaxPeriod: period,
          amount: roundCents(current.valueNumber as number),
          status: "CONFIRMED",
          description: `An earlier record for ${period} showed ${older.valueNumber}; the most recent record shows ${current.valueNumber}. These are sequential account states, not conflicting figures.`,
          supportingFactIds: [older.id, current.id],
        });
      }
    }
  }

  // The same amount appearing in two different documents is worth surfacing,
  // but only as a possible relationship until something explains it.
  const amountFacts = facts.filter((f) => typeof f.valueNumber === "number" && f.valueNumber !== 0 && f.documentId);
  for (let i = 0; i < amountFacts.length; i++) {
    for (let j = i + 1; j < amountFacts.length; j++) {
      const a = amountFacts[i];
      const b = amountFacts[j];
      if (a.documentId === b.documentId) continue;
      if (a.factKey === b.factKey && a.taxPeriod === b.taxPeriod) continue;
      if (!amountsEqual(a.valueNumber as number, b.valueNumber as number)) continue;
      relationships.push({
        relationshipType: "MATCHING_AMOUNT_ACROSS_DOCUMENTS",
        fromTaxPeriod: a.taxPeriod,
        toTaxPeriod: b.taxPeriod,
        amount: roundCents(a.valueNumber as number),
        status: "POSSIBLE",
        description: `The same amount appears as ${a.factKey.replace(/_/g, " ")} and ${b.factKey.replace(/_/g, " ")} in different documents.`,
        supportingFactIds: [a.id, b.id],
      });
    }
  }

  return { relationships, calculations, supersededFactIds, currentBalanceByPeriod };
}

export function calculationToFact(calculation: Calculation, taxPeriod: string) {
  return {
    factKey: `calculation:${calculation.calculationId.split(":")[0]}`,
    factType: "amount" as const,
    valueNumber: calculation.result,
    valueText: calculation.expression,
    taxPeriod,
    provenance: PROVENANCE.SYSTEM_CALCULATED,
    metadata: { inputs: calculation.inputs, balanced: calculation.balanced },
  };
}
