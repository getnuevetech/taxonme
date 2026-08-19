import { FACT_KEYS } from "./types";

// Case synthesis answers one question: what happened? It assembles the compiled
// ledgers into a timeline and a per-period position, separating what the
// evidence establishes from what is merely inferred or still open. It makes no
// tax judgements — eligibility, strategy, and advice belong downstream.

export const FACT_CLASSIFICATION = {
  ESTABLISHED_EVENT: "ESTABLISHED_EVENT",
  ESTABLISHED_CURRENT_STATE: "ESTABLISHED_CURRENT_STATE",
  ESTABLISHED_HISTORICAL_STATE: "ESTABLISHED_HISTORICAL_STATE",
  INFERRED_RELATIONSHIP: "INFERRED_RELATIONSHIP",
  UNRESOLVED: "UNRESOLVED",
} as const;

export type SynthesisEvent = {
  id: string;
  taxPeriod: string;
  eventType: string;
  transactionCode: string;
  description: string;
  eventDate: Date | null;
  amount: number | null;
};

export type SynthesisFact = {
  id: string;
  factKey: string;
  taxPeriod: string;
  valueNumber: number | null;
  valueText: string;
  effectiveDate: Date | null;
  status: string;
  provenance: string;
};

export type SynthesisAccountState = {
  taxPeriod: string;
  currentBalance: number | null;
  currentBalanceAsOf: Date | null;
  currentStatus: string;
};

export type SynthesisRelationship = {
  relationshipType: string;
  fromTaxPeriod: string;
  toTaxPeriod: string;
  amount: number | null;
  status: string;
  description: string;
};

export type SynthesisUnknown = { label: string; question: string; reason: string };

export type CaseReconstruction = {
  affected_tax_periods: string[];
  timeline: {
    date: string | null;
    tax_period: string | null;
    entry_type: string;
    description: string;
    amount: number | null;
    classification: string;
  }[];
  year_by_year_state: {
    tax_period: string;
    current_balance: number | null;
    current_balance_as_of: string | null;
    status: string;
    event_count: number;
    classification: string;
  }[];
  cross_period_events: SynthesisRelationship[];
  historical_positions: { tax_period: string; value: number | null; as_of: string | null; classification: string }[];
  current_positions: { tax_period: string; value: number | null; as_of: string | null; classification: string }[];
  established_relationships: SynthesisRelationship[];
  inferred_relationships: SynthesisRelationship[];
  remaining_unresolved_questions: { label: string; question: string; reason: string; classification: string }[];
};

function isoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function describeEvent(event: SynthesisEvent): string {
  const label = event.description || event.eventType.replace(/_/g, " ").toLowerCase();
  return event.transactionCode ? `${label} (TC ${event.transactionCode})` : label;
}

export function synthesizeCase(input: {
  events: SynthesisEvent[];
  facts: SynthesisFact[];
  accountStates: SynthesisAccountState[];
  relationships: SynthesisRelationship[];
  unknowns: SynthesisUnknown[];
}): CaseReconstruction {
  const periods = Array.from(
    new Set(
      [
        ...input.events.map((e) => e.taxPeriod),
        ...input.accountStates.map((s) => s.taxPeriod),
        ...input.facts.map((f) => f.taxPeriod),
      ].filter(Boolean),
    ),
  ).sort();

  // The timeline mixes account events with dated documentary facts, ordered so
  // sequence is visible before anyone reasons about the numbers.
  const timeline: CaseReconstruction["timeline"] = [
    ...input.events.map((event) => ({
      date: isoDate(event.eventDate),
      tax_period: event.taxPeriod || null,
      entry_type: event.eventType,
      description: describeEvent(event),
      amount: event.amount,
      classification: FACT_CLASSIFICATION.ESTABLISHED_EVENT,
    })),
    ...input.facts
      .filter((fact) => fact.effectiveDate && fact.factKey === FACT_KEYS.NOTICE_DEADLINE)
      .map((fact) => ({
        date: isoDate(fact.effectiveDate),
        tax_period: fact.taxPeriod || null,
        entry_type: "NOTICE_DEADLINE",
        description: `Response deadline stated on correspondence: ${fact.valueText}`,
        amount: null,
        classification: FACT_CLASSIFICATION.ESTABLISHED_EVENT,
      })),
  ].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const balanceFacts = input.facts.filter(
    (fact) => fact.factKey === FACT_KEYS.ACCOUNT_BALANCE && typeof fact.valueNumber === "number",
  );

  // An older balance is history; the most recent record is the current
  // position. They are sequential states, never a contradiction.
  const historical_positions = balanceFacts
    .filter((fact) => fact.status === "superseded")
    .map((fact) => ({
      tax_period: fact.taxPeriod,
      value: fact.valueNumber,
      as_of: isoDate(fact.effectiveDate),
      classification: FACT_CLASSIFICATION.ESTABLISHED_HISTORICAL_STATE,
    }));

  const current_positions = input.accountStates
    .filter((state) => state.currentBalance !== null)
    .map((state) => ({
      tax_period: state.taxPeriod,
      value: state.currentBalance,
      as_of: isoDate(state.currentBalanceAsOf),
      classification: FACT_CLASSIFICATION.ESTABLISHED_CURRENT_STATE,
    }));

  const year_by_year_state = periods.map((period) => {
    const state = input.accountStates.find((s) => s.taxPeriod === period);
    const eventCount = input.events.filter((e) => e.taxPeriod === period).length;
    return {
      tax_period: period,
      current_balance: state?.currentBalance ?? null,
      current_balance_as_of: isoDate(state?.currentBalanceAsOf ?? null),
      status: state?.currentStatus || "period_identified",
      event_count: eventCount,
      classification: state?.currentBalance !== null && state?.currentBalance !== undefined
        ? FACT_CLASSIFICATION.ESTABLISHED_CURRENT_STATE
        : eventCount > 0
          ? FACT_CLASSIFICATION.ESTABLISHED_EVENT
          : FACT_CLASSIFICATION.UNRESOLVED,
    };
  });

  const established_relationships = input.relationships.filter((r) => r.status === "CONFIRMED");
  const inferred_relationships = input.relationships.filter((r) => r.status !== "CONFIRMED");

  return {
    affected_tax_periods: periods,
    timeline,
    year_by_year_state,
    cross_period_events: established_relationships.filter(
      (r) => r.fromTaxPeriod && r.toTaxPeriod && r.fromTaxPeriod !== r.toTaxPeriod,
    ),
    historical_positions,
    current_positions,
    established_relationships,
    inferred_relationships,
    remaining_unresolved_questions: input.unknowns.map((unknown) => ({
      label: unknown.label,
      question: unknown.question,
      reason: unknown.reason,
      classification: FACT_CLASSIFICATION.UNRESOLVED,
    })),
  };
}
