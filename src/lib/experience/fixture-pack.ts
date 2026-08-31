/**
 * Phase −1.9 S8 — tax Experience regression fixtures.
 * No live fine-tuning. Shared records contain institutional keys only.
 */
import assert from "node:assert/strict";
import { askableNow, runConversationIntelligence } from "@/lib/conversation";
import {
  applyConsultantCorrection,
  assertIsPatternCandidate,
  buildPatternCandidate,
} from "./corrections";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  type AnonymizedExperienceRecord,
} from "./deidentify";
import type { ExperienceRecordV0 } from "./experience-record";
import {
  buildNegativeLearningRecords,
  hasNegativeLearningViolation,
} from "./negative-learning";
import {
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON,
  isPrematureFinancialSchemaAsk,
} from "./negative-lessons";
import { checkOutcomeAuthority } from "./outcomes";
import { canPromoteToProduction } from "./registry";
import {
  EXPERIENCE_SEARCH_PRECEDENCE,
  assertAllProductionLevel,
  formatExperienceSearchBlock,
  productionPatternAskHints,
  rankProductionPatterns,
} from "./search";
import {
  HARM_AUTO_STALE_MIN,
  filterServableProductionRows,
  isActivelyServable,
  shouldAutoStaleFromTelemetry,
} from "./telemetry";

export const EXPERIENCE_CANONICAL_NARRATIVE =
  "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";

export type ExperienceFixtureKind = "positive" | "negative";
export type ExperiencePackFixture = {
  id: string;
  label: string;
  kind: ExperienceFixtureKind;
  run: () => ExperienceFixtureResult;
};
export type ExperienceFixtureResult = {
  id: string;
  kind: ExperienceFixtureKind;
  notes: string[];
};

function baseProductionPattern(
  over: Partial<AnonymizedExperienceRecord> = {},
): AnonymizedExperienceRecord {
  return {
    schema_version: "l1_anon",
    workspace: "existing_case",
    decision_target: "identify_available_pathways",
    current_scope: "pre-filing tax options",
    facts_considered: [
      "balance_due",
      "collection_notice",
      "uncertain_ability_to_pay",
      "full_form_433_package",
    ],
    decision_changing_facts: ["ability_to_pay", "collection_stage"],
    facts_not_needed_yet: [
      "full_form_433_package",
      "complete_financial_statement",
    ],
    facts_discarded: [
      "full_form_433_package",
      "complete_financial_statement",
    ],
    pathways_considered: [
      "installment_agreement",
      "currently_not_collectible",
      "offer_in_compromise",
    ],
    clarification_key: "ability_to_pay",
    clarification_reason_key: "changes_relief_pathway",
    clarifications_suppressed: ["full_form_433_package"],
    document_kinds: [],
    authority_ids: [],
    answer_changed_after_clarification: false,
    has_model_correction: false,
    has_reviewer_correction: true,
    outcome_kind: null,
    response_mode: "answer_then_targeted_question",
    invokes_case_engine: false,
    existing_government_case: true,
    interaction_intent: "personal_question",
    negative_lesson_ids: [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id],
    negative_learning: [],
    capture_enrichment: "l2",
    source_digest: "s8taxprod01",
    promotion_level: 4,
    origin: "consultant_correction",
    correction: {
      origin: "consultant_correction",
      failure_type: "premature_clarification",
      incorrect_key: "full_form_433_package",
      preferred_key: "ability_to_pay",
      note_key: "ask_payment_capacity_first",
      lesson_id: TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id,
    },
    ...over,
  };
}

function runCanonicalCapture(): ExperienceFixtureResult {
  const intel = runConversationIntelligence({
    message: EXPERIENCE_CANONICAL_NARRATIVE,
    goal: "What are my options?",
  });
  const record = intel.experience_record as ExperienceRecordV0;
  assert.equal(record.capture_enrichment, "l2");
  assert.equal(record.decision_target, "identify_available_pathways");
  assert.ok(record.decision_changing_facts.includes("ability_to_pay"));
  assert.ok(record.facts_discarded?.includes("full_form_433_package"));
  const lesson = record.negative_learning_records?.find(
    (item) => item.lesson_id === TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id,
  );
  assert.equal(lesson?.evaluation, "avoided");
  assert.equal(hasNegativeLearningViolation(record.negative_learning_records || []), false);
  const ask = askableNow(intel.need_to_know)[0] || intel.strategy.ask_now[0];
  assert.ok(ask);
  assert.equal(isPrematureFinancialSchemaAsk(ask.question), false);
  assert.match(ask.question, /monthly payment|paying anything/i);

  const anon = deidentifyExperienceRecord(record, {
    sourceId: "s8_tax_canonical",
  });
  assertSafeForSharedExperience(anon);
  assert.equal(canPromoteToProduction(anon).ok, true);
  return {
    id: "exp_canonical_tax_relief_capture",
    kind: "positive",
    notes: [
      "ability to pay selected",
      "complete financial schema deferred",
    ],
  };
}

function runPrematureSchemaViolation(): ExperienceFixtureResult {
  const intel = runConversationIntelligence({
    message: EXPERIENCE_CANONICAL_NARRATIVE,
  });
  const records = buildNegativeLearningRecords({
    message: EXPERIENCE_CANONICAL_NARRATIVE,
    contract: intel.question_contract,
    askNow: [
      {
        question:
          "Please complete the full Form 433 package with all income, expenses, and assets.",
        tier: "critical_now",
        reason: "Schema completeness",
        changes_branch: true,
        branches_affected: [],
      },
    ],
  });
  assert.equal(records[0].evaluation, "violated");
  assert.equal(hasNegativeLearningViolation(records), true);
  return {
    id: "exp_neg_premature_financial_schema",
    kind: "negative",
    notes: ["full Form 433 package ask is a violation"],
  };
}

function runConsultantCorrectionCandidate(): ExperienceFixtureResult {
  const record = runConversationIntelligence({
    message: EXPERIENCE_CANONICAL_NARRATIVE,
  }).experience_record as ExperienceRecordV0;
  const flawed: ExperienceRecordV0 = {
    ...record,
    decision_changing_facts: ["full_form_433_package"],
    facts_discarded: (record.facts_discarded || []).filter(
      (key) => key !== "full_form_433_package",
    ),
    reviewer_correction: null,
  };
  const corrected = applyConsultantCorrection(flawed, {
    failure_type: "premature_clarification",
    incorrect_key: "full_form_433_package",
    preferred_key: "ability_to_pay",
    note_key: "ask_payment_capacity_first",
  });
  const candidate = buildPatternCandidate(corrected, {
    sourceId: "s8_tax_correction",
  });
  assertIsPatternCandidate(candidate);
  assert.equal(
    candidate.correction?.lesson_id,
    TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id,
  );
  return {
    id: "exp_tax_consultant_correction_candidate",
    kind: "positive",
    notes: ["candidate level 1", "tax schema lesson linked"],
  };
}

function runOutcomeAuthorityGates(): ExperienceFixtureResult {
  const blocked = checkOutcomeAuthority({
    outcome_kind: "notice_resolved",
    government_system: "irs",
    form_or_notice_key: "cp503",
    authority_keys: [],
    authority_publisher: "IRS",
    note_key: "notice_closed",
  });
  assert.equal(blocked.ok, false);
  const accepted = checkOutcomeAuthority({
    outcome_kind: "installment_agreement_accepted",
    government_system: "irs",
    form_or_notice_key: "form_9465",
    decision_changing_facts: ["ability_to_pay"],
    authority_keys: ["irs_installment_agreement_guidance"],
    authority_publisher: "IRS",
    note_key: "monthly_plan_accepted",
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.outranked_by, "current_authority");
  return {
    id: "exp_tax_outcome_authority_gates",
    kind: "positive",
    notes: ["authority required", "outcome remains historical"],
  };
}

function runProductionSearchL4Only(): ExperienceFixtureResult {
  const production = baseProductionPattern();
  const other = baseProductionPattern({
    decision_target: "explain_document_or_notice",
    workspace: "question_only",
    source_digest: "s8taxprod02",
    negative_lesson_ids: [],
    correction: undefined,
    has_reviewer_correction: false,
  });
  assert.throws(() =>
    assertAllProductionLevel([
      baseProductionPattern({ promotion_level: 1 }),
    ]),
  );
  const hits = rankProductionPatterns([production, other], {
    decisionTarget: "identify_available_pathways",
    workspace: "existing_case",
    factKeys: ["ability_to_pay", "collection_notice"],
    pathways: ["installment_agreement"],
    negativeLessonIds: [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id],
  });
  assert.equal(hits[0].pattern.source_digest, "s8taxprod01");
  assert.match(
    formatExperienceSearchBlock(hits),
    /VALIDATED PRODUCTION PATTERNS/,
  );
  assert.match(EXPERIENCE_SEARCH_PRECEDENCE, /CURRENT AUTHORITY/);
  const hints = productionPatternAskHints(hits);
  assert.ok(hints.suppress_keys.includes("full_form_433_package"));
  assert.ok(hints.prefer_keys.includes("ability_to_pay"));
  return {
    id: "exp_tax_production_search_l4",
    kind: "positive",
    notes: ["L4-only", "Form 433 schema suppressed"],
  };
}

function runStaleExcludedFromServe(): ExperienceFixtureResult {
  const rows = filterServableProductionRows([
    { promotionLevel: 4, staleAt: null, anonJson: "{}" },
    { promotionLevel: 4, staleAt: new Date(), anonJson: "{}" },
    { promotionLevel: 1, staleAt: null, anonJson: "{}" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(
    isActivelyServable({ promotionLevel: 4, staleAt: new Date() }),
    false,
  );
  return {
    id: "exp_stale_excluded_from_serve",
    kind: "negative",
    notes: ["stale and non-production rows are not servable"],
  };
}

function runTelemetryAutoStale(): ExperienceFixtureResult {
  assert.equal(shouldAutoStaleFromTelemetry(0, 2), false);
  assert.equal(
    shouldAutoStaleFromTelemetry(0, HARM_AUTO_STALE_MIN),
    true,
  );
  assert.equal(shouldAutoStaleFromTelemetry(3, 6), true);
  return {
    id: "exp_telemetry_auto_stale",
    kind: "positive",
    notes: ["harm threshold auto-stales"],
  };
}

function runNonProductionRefusedInBlock(): ExperienceFixtureResult {
  assert.throws(() =>
    formatExperienceSearchBlock([
      {
        pattern: baseProductionPattern({ promotion_level: 2 }),
        score: 1,
        match_reasons: ["test"],
      },
    ]),
  );
  return {
    id: "exp_neg_non_production_prompt_block",
    kind: "negative",
    notes: ["non-production prompt pattern refused"],
  };
}

export const EXPERIENCE_FIXTURE_PACK: ExperiencePackFixture[] = [
  {
    id: "exp_canonical_tax_relief_capture",
    label: "Canonical CP503 relief options capture",
    kind: "positive",
    run: runCanonicalCapture,
  },
  {
    id: "exp_neg_premature_financial_schema",
    label: "Premature full Form 433 request violates lesson",
    kind: "negative",
    run: runPrematureSchemaViolation,
  },
  {
    id: "exp_tax_consultant_correction_candidate",
    label: "Tax consultant correction becomes candidate",
    kind: "positive",
    run: runConsultantCorrectionCandidate,
  },
  {
    id: "exp_tax_outcome_authority_gates",
    label: "Tax outcome authority gates",
    kind: "positive",
    run: runOutcomeAuthorityGates,
  },
  {
    id: "exp_tax_production_search_l4",
    label: "Experience Search uses L4 Production only",
    kind: "positive",
    run: runProductionSearchL4Only,
  },
  {
    id: "exp_stale_excluded_from_serve",
    label: "Stale patterns do not serve",
    kind: "negative",
    run: runStaleExcludedFromServe,
  },
  {
    id: "exp_telemetry_auto_stale",
    label: "Harm telemetry auto-stales",
    kind: "positive",
    run: runTelemetryAutoStale,
  },
  {
    id: "exp_neg_non_production_prompt_block",
    label: "Prompt block rejects non-production",
    kind: "negative",
    run: runNonProductionRefusedInBlock,
  },
];

export function listExperienceFixtureIds(): string[] {
  return EXPERIENCE_FIXTURE_PACK.map((fixture) => fixture.id);
}

export function runExperienceFixture(
  id: string,
): ExperienceFixtureResult {
  const fixture = EXPERIENCE_FIXTURE_PACK.find((item) => item.id === id);
  if (!fixture) throw new Error(`unknown experience fixture: ${id}`);
  const result = fixture.run();
  assert.equal(result.id, fixture.id);
  assert.equal(result.kind, fixture.kind);
  return result;
}

export function runExperienceFixturePack(): ExperienceFixtureResult[] {
  return EXPERIENCE_FIXTURE_PACK.map((fixture) =>
    runExperienceFixture(fixture.id),
  );
}
