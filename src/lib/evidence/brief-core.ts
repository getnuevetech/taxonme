import { isEvidentiaryProvenance, PROVENANCE } from "./types";

/**
 * Every surface that speaks to the customer — or drafts correspondence to the
 * IRS on their behalf — needs the same view of what the evidence establishes.
 * The brief is assembled deterministically so that no model has to infer which
 * figures are safe to state, and so the same case reads identically in a chat
 * reply, a letter draft, and a closing summary.
 */
export type BriefFact = {
  factKey: string;
  provenance: string;
  valueText: string;
  valueNumber: number | null;
  taxPeriod: string;
};

export type BriefPeriod = {
  taxPeriod: string;
  currentBalance: number | null;
  currentBalanceAsOf: Date | null;
};

export type BriefEvent = {
  taxPeriod: string;
  eventType: string;
  description: string;
  eventDate: Date | null;
  amount: number | null;
};

export type BriefRelationship = { relationshipType: string; description: string; status: string };
export type BriefUnknown = { label: string; status: string; reason: string };

export type EvidenceBrief = {
  hasEvidence: boolean;
  establishedPositions: { taxPeriod: string; balance: number | null; asOf: string | null }[];
  establishedFacts: { label: string; value: string; taxPeriod: string }[];
  reportedNotEstablished: string[];
  openUnknowns: string[];
  limitations: string[];
  statableAmounts: number[];
  text: string;
};

function usd(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function factLabel(factKey: string): string {
  return factKey.replace(/_/g, " ");
}

function factValue(fact: BriefFact): string {
  if (fact.valueNumber !== null && fact.valueNumber !== undefined) return usd(fact.valueNumber);
  return fact.valueText;
}

export function formatEvidenceBrief(input: {
  periods: BriefPeriod[];
  facts: BriefFact[];
  events: BriefEvent[];
  relationships: BriefRelationship[];
  unknowns: BriefUnknown[];
  limitations: string[];
}): EvidenceBrief {
  const established = input.facts.filter((f) => isEvidentiaryProvenance(f.provenance) && factValue(f));
  const reported = input.facts.filter((f) => f.provenance === PROVENANCE.USER_REPORTED && factValue(f));

  const establishedPositions = input.periods
    .slice()
    .sort((a, b) => a.taxPeriod.localeCompare(b.taxPeriod))
    .map((p) => ({ taxPeriod: p.taxPeriod, balance: p.currentBalance, asOf: isoDate(p.currentBalanceAsOf) }));

  const establishedFacts = established.map((f) => ({
    label: factLabel(f.factKey),
    value: factValue(f),
    taxPeriod: f.taxPeriod,
  }));

  const openUnknowns = input.unknowns
    .filter((u) => u.status === "ACTIVE" || u.status === "AWAITING_CUSTOMER")
    .map((u) => u.label)
    .filter(Boolean);

  // Only figures the evidence establishes may be restated downstream. Anything
  // else has to be described in words rather than asserted as a number.
  const statableAmounts = Array.from(
    new Set(
      [
        ...establishedPositions.map((p) => p.balance),
        ...established.map((f) => f.valueNumber),
        ...input.events.map((e) => e.amount),
      ].filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
    ),
  );

  const hasEvidence = establishedPositions.length > 0 || establishedFacts.length > 0 || input.events.length > 0;
  if (!hasEvidence) {
    return {
      hasEvidence: false,
      establishedPositions,
      establishedFacts,
      reportedNotEstablished: reported.map((f) => `${factLabel(f.factKey)}: ${factValue(f)}`),
      openUnknowns,
      limitations: input.limitations,
      statableAmounts,
      text:
        "ESTABLISHED EVIDENCE: none on file for this case yet.\n" +
        "Do not state any figure, date, or account position as fact. Describe what is needed instead.",
    };
  }

  const lines: string[] = [];
  lines.push("ESTABLISHED EVIDENCE (from documents on file — these are the only figures that may be stated as fact):");

  if (establishedPositions.length > 0) {
    lines.push("Current account position:");
    for (const p of establishedPositions) {
      const balance = p.balance === null ? "not established" : usd(p.balance);
      lines.push(`- Tax period ${p.taxPeriod}: balance ${balance}${p.asOf ? ` as of ${p.asOf}` : ""}.`);
    }
  }

  if (input.events.length > 0) {
    lines.push("Account history:");
    for (const e of input.events.slice(0, 25)) {
      const date = isoDate(e.eventDate) ?? "date not stated";
      const amount = typeof e.amount === "number" ? ` ${usd(e.amount)}` : "";
      lines.push(`- ${date} · ${e.taxPeriod || "period not stated"} · ${e.description || e.eventType}${amount}`);
    }
  }

  if (establishedFacts.length > 0) {
    lines.push("Established facts:");
    for (const f of establishedFacts.slice(0, 25)) {
      lines.push(`- ${f.label}${f.taxPeriod ? ` (${f.taxPeriod})` : ""}: ${f.value}`);
    }
  }

  const confirmedRelationships = input.relationships.filter((r) => r.status === "CONFIRMED" && r.description);
  if (confirmedRelationships.length > 0) {
    lines.push("Confirmed relationships between records:");
    for (const r of confirmedRelationships.slice(0, 10)) lines.push(`- ${r.description}`);
  }

  if (reported.length > 0) {
    lines.push("REPORTED BY THE CUSTOMER, NOT ESTABLISHED (never state these as fact or as the IRS position):");
    for (const f of reported.slice(0, 10)) lines.push(`- ${factLabel(f.factKey)}: ${factValue(f)}`);
  }

  if (openUnknowns.length > 0) {
    lines.push("STILL UNRESOLVED (do not assert an answer to any of these):");
    for (const u of openUnknowns.slice(0, 10)) lines.push(`- ${u}`);
  }

  if (input.limitations.length > 0) {
    lines.push("LIMITS ON THIS EVIDENCE:");
    for (const l of input.limitations.slice(0, 10)) lines.push(`- ${l}`);
  }

  lines.push(
    "RULES: State no dollar figure, tax period, or account position that does not appear above. " +
      "If something needed is absent, say it is not established rather than estimating it.",
  );

  return {
    hasEvidence: true,
    establishedPositions,
    establishedFacts,
    reportedNotEstablished: reported.map((f) => `${factLabel(f.factKey)}: ${factValue(f)}`),
    openUnknowns,
    limitations: input.limitations,
    statableAmounts,
    text: lines.join("\n"),
  };
}
