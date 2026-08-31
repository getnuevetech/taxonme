/**
 * Phase −1.9 L4 — authority-checked tax outcomes become candidates.
 * Outcomes are historical experience, never law and never auto-promoted.
 */
import type { ExperienceRecordV0 } from "./experience-record";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  textLooksLikePii,
  type AnonymizedExperienceRecord,
  type AnonymizedOutcome,
  type PromotionLevel,
} from "./deidentify";
import {
  isInstitutionalKey,
  PATTERN_CANDIDATE_LEVEL,
} from "./corrections";

export const OUTCOME_KINDS = [
  "installment_agreement_accepted",
  "currently_not_collectible",
  "offer_in_compromise_accepted",
  "penalty_abatement",
  "notice_resolved",
  "assessment_confirmed",
  "levy_released",
  "other_government_action",
] as const;
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

export const GOVERNMENT_SYSTEMS = [
  "irs",
  "state_dor",
  "tax_court_collections",
] as const;
export type GovernmentSystem = (typeof GOVERNMENT_SYSTEMS)[number];

export const ALLOWED_AUTHORITY_PUBLISHERS = [
  "IRS",
  "STATE_DOR",
  "TAX_COURT",
] as const;
export type AuthorityPublisher =
  (typeof ALLOWED_AUTHORITY_PUBLISHERS)[number];

export const AUTHORITY_PRECEDENCE = [
  "current_authority",
  "reviewed_internal_rule",
  "validated_production_pattern",
  "historical_experience",
  "model_inference",
] as const;
export type AuthorityPrecedence = (typeof AUTHORITY_PRECEDENCE)[number];

export type GovernmentOutcomeInput = {
  outcome_kind: OutcomeKind;
  government_system: GovernmentSystem;
  form_or_notice_key: string;
  decision_changing_facts?: string[];
  authority_keys: string[];
  authority_publisher: AuthorityPublisher | string;
  note_key: string;
};

export type AuthorityCheckResult = {
  ok: boolean;
  reason: string;
  signal_precedence: AuthorityPrecedence;
  outranked_by: "current_authority";
};

export type AppliedGovernmentOutcome = {
  kind: OutcomeKind;
  detail: string;
  government_system: GovernmentSystem;
  form_or_notice_key: string;
  authority_keys: string[];
  authority_publisher: string;
  authority_check: "passed";
  signal_precedence: "historical_experience";
};

export const OUTCOME_CANDIDATE_LEVEL: PromotionLevel =
  PATTERN_CANDIDATE_LEVEL;

function normalizePublisher(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeOutcomeInput(
  raw: GovernmentOutcomeInput,
): GovernmentOutcomeInput {
  const outcome_kind = OUTCOME_KINDS.includes(raw.outcome_kind)
    ? raw.outcome_kind
    : "other_government_action";
  if (!GOVERNMENT_SYSTEMS.includes(raw.government_system)) {
    throw new Error(
      "government_system must be irs, state_dor, or tax_court_collections.",
    );
  }
  const form_or_notice_key = String(raw.form_or_notice_key || "")
    .trim()
    .toLowerCase();
  const note_key = String(raw.note_key || "").trim().toLowerCase();
  const authority_keys = (raw.authority_keys || [])
    .map((key) => String(key).trim().toLowerCase())
    .filter(Boolean);
  const decision_changing_facts = (raw.decision_changing_facts || [])
    .map((key) => String(key).trim().toLowerCase())
    .filter(Boolean);
  const authority_publisher = normalizePublisher(raw.authority_publisher);

  for (const [label, value] of [
    ["form_or_notice_key", form_or_notice_key],
    ["note_key", note_key],
  ] as const) {
    if (!isInstitutionalKey(value)) {
      throw new Error(`${label} must be an institutional snake_case key.`);
    }
  }
  for (const key of [...authority_keys, ...decision_changing_facts]) {
    if (!isInstitutionalKey(key)) {
      throw new Error(`Invalid institutional key: ${key}`);
    }
    if (textLooksLikePii(key)) {
      throw new Error("Outcome keys must not contain PII-like patterns.");
    }
  }
  if (
    textLooksLikePii(form_or_notice_key) ||
    textLooksLikePii(note_key) ||
    textLooksLikePii(authority_publisher)
  ) {
    throw new Error("Outcome fields must not contain PII-like patterns.");
  }

  return {
    outcome_kind,
    government_system: raw.government_system,
    form_or_notice_key,
    decision_changing_facts,
    authority_keys,
    authority_publisher,
    note_key,
  };
}

export function checkOutcomeAuthority(
  raw: GovernmentOutcomeInput,
): AuthorityCheckResult {
  let input: GovernmentOutcomeInput;
  try {
    input = normalizeOutcomeInput(raw);
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error ? error.message : "Invalid outcome input.",
      signal_precedence: "historical_experience",
      outranked_by: "current_authority",
    };
  }
  if (
    !(ALLOWED_AUTHORITY_PUBLISHERS as readonly string[]).includes(
      input.authority_publisher,
    )
  ) {
    return {
      ok: false,
      reason: `authority_publisher must be one of ${ALLOWED_AUTHORITY_PUBLISHERS.join(", ")}.`,
      signal_precedence: "historical_experience",
      outranked_by: "current_authority",
    };
  }
  if (!input.authority_keys.length) {
    return {
      ok: false,
      reason: "At least one authority_key is required.",
      signal_precedence: "historical_experience",
      outranked_by: "current_authority",
    };
  }
  return {
    ok: true,
    reason:
      "Outcome is linked to a recognized tax authority and remains historical experience only (outcome ≠ law).",
    signal_precedence: "historical_experience",
    outranked_by: "current_authority",
  };
}

export function authorityKeysRecognized(
  authorityKeys: string[],
  catalogKeys: string[],
): { ok: boolean; missing: string[] } {
  const catalog = new Set(catalogKeys.map((key) => key.toLowerCase()));
  if (!catalog.size) return { ok: true, missing: [] };
  const missing = authorityKeys.filter(
    (key) => !catalog.has(key.toLowerCase()),
  );
  return { ok: !missing.length, missing };
}

export function applyGovernmentOutcome(
  record: ExperienceRecordV0,
  raw: GovernmentOutcomeInput,
): ExperienceRecordV0 {
  const gate = checkOutcomeAuthority(raw);
  if (!gate.ok) throw new Error(`Authority check failed: ${gate.reason}`);
  const input = normalizeOutcomeInput(raw);
  const outcome: AppliedGovernmentOutcome = {
    kind: input.outcome_kind,
    detail: input.note_key,
    government_system: input.government_system,
    form_or_notice_key: input.form_or_notice_key,
    authority_keys: input.authority_keys,
    authority_publisher: input.authority_publisher,
    authority_check: "passed",
    signal_precedence: "historical_experience",
  };
  return {
    ...record,
    facts_considered: unique([
      ...record.facts_considered,
      input.form_or_notice_key,
      input.outcome_kind,
      ...(input.decision_changing_facts || []),
    ]),
    decision_changing_facts: unique([
      ...record.decision_changing_facts,
      ...(input.decision_changing_facts || []),
    ]),
    authority_ids: unique([
      ...record.authority_ids,
      ...input.authority_keys,
    ]),
    outcome,
    existing_government_case: true,
    capture_enrichment: "l2",
  };
}

export function outcomeToAnon(
  outcome: AppliedGovernmentOutcome,
): AnonymizedOutcome {
  return {
    origin: "government_outcome",
    outcome_kind: outcome.kind,
    government_system: outcome.government_system,
    form_or_notice_key: outcome.form_or_notice_key,
    authority_keys: [...outcome.authority_keys],
    authority_publisher: outcome.authority_publisher,
    note_key: outcome.detail,
    signal_precedence: "historical_experience",
    outranked_by: "current_authority",
  };
}

export function buildOutcomePatternCandidate(
  record: ExperienceRecordV0,
  opts?: { sourceId?: string },
): AnonymizedExperienceRecord {
  const outcome = record.outcome as AppliedGovernmentOutcome | null;
  if (!outcome || outcome.authority_check !== "passed") {
    throw new Error(
      "Outcome candidate requires an authority-checked government outcome.",
    );
  }
  const anon = deidentifyExperienceRecord(record, opts);
  const candidate: AnonymizedExperienceRecord = {
    ...anon,
    promotion_level: OUTCOME_CANDIDATE_LEVEL,
    origin: "government_outcome",
    outcome_kind: outcome.kind,
    outcome: outcomeToAnon(outcome),
    authority_ids: unique([
      ...anon.authority_ids,
      ...outcome.authority_keys,
    ]),
  };
  assertIsOutcomeCandidate(candidate);
  return candidate;
}

export function assertIsOutcomeCandidate(
  anon: AnonymizedExperienceRecord,
): void {
  assertSafeForSharedExperience(anon);
  if (
    anon.promotion_level !== OUTCOME_CANDIDATE_LEVEL ||
    anon.origin !== "government_outcome" ||
    !anon.outcome
  ) {
    throw new Error(
      "Outcome candidate must be level 1 with government outcome provenance.",
    );
  }
  if (anon.outcome.signal_precedence !== "historical_experience") {
    throw new Error("Outcome candidates must remain historical experience.");
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
