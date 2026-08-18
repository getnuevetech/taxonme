import { FACT_KEYS, isEvidentiaryProvenance } from "./types";

// Question suppression: TaxOnMe must exhaust the evidence it already holds
// before asking the customer for anything. A question is only suppressed when a
// document (or our own arithmetic) already answers it — the customer's own
// earlier wording never counts as the answer.

export type KnownFact = {
  id?: string;
  factKey: string;
  provenance: string;
  valueText?: string | null;
  valueNumber?: number | null;
  taxPeriod?: string | null;
};

export type QuestionResolution = {
  suppressed: boolean;
  reason: string;
  resolvedValue: string;
  supportingFactIds: string[];
  missingFact: string;
};

// Clarify question key → the evidence that would already answer it.
export const QUESTION_EVIDENCE_REQUIREMENTS: Record<string, { factKeys: string[]; missingFact: string; label: string }> = {
  tax_year: { factKeys: [FACT_KEYS.TAX_PERIOD], missingFact: "tax period", label: "Tax year" },
  balance_amount: { factKeys: [FACT_KEYS.ACCOUNT_BALANCE], missingFact: "account balance", label: "Balance owed" },
  refund_expected: { factKeys: [FACT_KEYS.REFUND_EXPECTED], missingFact: "expected refund", label: "Expected refund" },
  refund_received: { factKeys: [FACT_KEYS.REFUND_ISSUED], missingFact: "refund issued", label: "Refund received" },
  notice_details: { factKeys: [FACT_KEYS.NOTICE_CODE], missingFact: "notice identification", label: "Notice details" },
  have_transcript: { factKeys: [FACT_KEYS.TRANSCRIPT_ON_FILE], missingFact: "account transcript", label: "Account transcript" },
};

function describe(fact: KnownFact): string {
  if (typeof fact.valueNumber === "number" && Number.isFinite(fact.valueNumber)) {
    return fact.valueNumber.toLocaleString("en-US", { style: "currency", currency: "USD" });
  }
  return String(fact.valueText ?? "").trim();
}

export function resolveQuestionFromFacts(questionKey: string, facts: KnownFact[]): QuestionResolution {
  const requirement = QUESTION_EVIDENCE_REQUIREMENTS[questionKey];
  if (!requirement) {
    return { suppressed: false, reason: "", resolvedValue: "", supportingFactIds: [], missingFact: "" };
  }
  const matches = facts.filter(
    (fact) => requirement.factKeys.includes(fact.factKey) && isEvidentiaryProvenance(fact.provenance) && describe(fact) !== "",
  );
  if (matches.length === 0) {
    return { suppressed: false, reason: "", resolvedValue: "", supportingFactIds: [], missingFact: requirement.missingFact };
  }
  return {
    suppressed: true,
    reason: `${requirement.label} is already established from uploaded evidence.`,
    resolvedValue: describe(matches[0]),
    supportingFactIds: matches.map((fact) => fact.id ?? "").filter(Boolean),
    missingFact: requirement.missingFact,
  };
}

// Free-text unknowns (an issue's "still unclear" list) are matched to fact keys
// by intent so evidence can retire them too.
const UNKNOWN_TEXT_RULES: { factKey: string; pattern: RegExp }[] = [
  { factKey: FACT_KEYS.ACCOUNT_BALANCE, pattern: /(current|account)?\s*balance|amount\s+(owed|due)|how much (i|we) owe/i },
  { factKey: FACT_KEYS.REFUND_ISSUED, pattern: /refund (issued|received|amount|arrived)/i },
  { factKey: FACT_KEYS.NOTICE_CODE, pattern: /notice (code|number|type)/i },
  { factKey: FACT_KEYS.NOTICE_DEADLINE, pattern: /(respond|response|reply).{0,20}(deadline|date)|deadline/i },
  { factKey: FACT_KEYS.TAX_PERIOD, pattern: /tax year|tax period|which year/i },
];

export function resolveUnknownTextFromFacts(unknownText: string, facts: KnownFact[]): QuestionResolution {
  for (const rule of UNKNOWN_TEXT_RULES) {
    if (!rule.pattern.test(unknownText)) continue;
    const matches = facts.filter(
      (fact) => fact.factKey === rule.factKey && isEvidentiaryProvenance(fact.provenance) && describe(fact) !== "",
    );
    if (matches.length > 0) {
      return {
        suppressed: true,
        reason: "Already established from uploaded evidence.",
        resolvedValue: describe(matches[0]),
        supportingFactIds: matches.map((fact) => fact.id ?? "").filter(Boolean),
        missingFact: rule.factKey,
      };
    }
  }
  return { suppressed: false, reason: "", resolvedValue: "", supportingFactIds: [], missingFact: "" };
}
