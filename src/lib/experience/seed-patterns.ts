/**
 * Package S — curated institutional L3/L4 Production patterns for Experience Search.
 * De-identified keys only. Seed / upsert by stable source_digest. No customer PII.
 */
import { db } from "@/lib/db";
import {
  assertSafeForSharedExperience,
  type AnonymizedExperienceRecord,
} from "./deidentify";
import { TAX_RELIEF_SCHEMA_NEGATIVE_LESSON } from "./negative-lessons";
import { canPromoteToProduction } from "./registry";

/** Stable digests — upsert identity for seed + gate checks. */
export const PACKAGE_S_TAX_RELIEF_DIGEST = "pkg-s-tax-relief-ability-to-pay-v1";
export const PACKAGE_S_NOTICE_DIGEST = "pkg-s-notice-identity-before-schema-v1";
export const PACKAGE_S_THIN_DEBT_DIGEST = "pkg-s-thin-debt-transcript-first-v1";

function institutionalProductionPattern(
  over: Partial<AnonymizedExperienceRecord> &
    Pick<AnonymizedExperienceRecord, "source_digest" | "decision_target" | "workspace">,
): AnonymizedExperienceRecord {
  const pattern: AnonymizedExperienceRecord = {
    schema_version: "l1_anon",
    workspace: over.workspace,
    decision_target: over.decision_target,
    current_scope: over.current_scope ?? "institutional_seed",
    facts_considered: over.facts_considered ?? [],
    decision_changing_facts: over.decision_changing_facts ?? [],
    facts_not_needed_yet: over.facts_not_needed_yet ?? [],
    facts_discarded: over.facts_discarded ?? [],
    pathways_considered: over.pathways_considered ?? [],
    clarification_key: over.clarification_key ?? null,
    clarification_reason_key: over.clarification_reason_key ?? null,
    clarifications_suppressed: over.clarifications_suppressed ?? [],
    document_kinds: over.document_kinds ?? [],
    authority_ids: over.authority_ids ?? [],
    answer_changed_after_clarification:
      over.answer_changed_after_clarification ?? false,
    has_model_correction: over.has_model_correction ?? false,
    has_reviewer_correction: over.has_reviewer_correction ?? true,
    outcome_kind: over.outcome_kind ?? null,
    response_mode: over.response_mode ?? "answer_then_targeted_question",
    invokes_case_engine: over.invokes_case_engine ?? false,
    existing_government_case: over.existing_government_case ?? false,
    interaction_intent: over.interaction_intent ?? "personal_question",
    negative_lesson_ids: over.negative_lesson_ids ?? [],
    negative_learning: over.negative_learning ?? [],
    capture_enrichment: over.capture_enrichment ?? "l2",
    source_digest: over.source_digest,
    promotion_level: 4,
    origin: over.origin ?? "consultant_correction",
    correction: over.correction,
    outcome: over.outcome,
  };
  assertSafeForSharedExperience(pattern);
  const gate = canPromoteToProduction(pattern);
  if (!gate.ok) {
    throw new Error(`Package S pattern not Production-eligible: ${gate.reason}`);
  }
  return pattern;
}

/** Curated non-stale L4 patterns shipped with the product. */
export function curatedProductionPatterns(): AnonymizedExperienceRecord[] {
  return [
    institutionalProductionPattern({
      source_digest: PACKAGE_S_TAX_RELIEF_DIGEST,
      decision_target: "identify_available_pathways",
      workspace: "existing_case",
      current_scope: "pre-filing tax relief options",
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
      existing_government_case: true,
      negative_lesson_ids: [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id],
      correction: {
        origin: "consultant_correction",
        failure_type: "premature_clarification",
        incorrect_key: "full_form_433_package",
        preferred_key: "ability_to_pay",
        note_key: "ask_payment_capacity_first",
        lesson_id: TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id,
      },
    }),
    institutionalProductionPattern({
      source_digest: PACKAGE_S_NOTICE_DIGEST,
      decision_target: "explain_document_or_notice",
      workspace: "question_only",
      current_scope: "notice identity before resolution schema",
      facts_considered: ["collection_notice", "notice_identity"],
      decision_changing_facts: ["notice_code", "collection_notice"],
      facts_not_needed_yet: [
        "full_form_433_package",
        "complete_financial_statement",
      ],
      facts_discarded: [
        "full_form_433_package",
        "complete_financial_statement",
      ],
      pathways_considered: [],
      clarification_key: "notice_code",
      clarification_reason_key: "identify_notice_before_playbook",
      clarifications_suppressed: ["full_form_433_package"],
      response_mode: "answer",
      correction: {
        origin: "consultant_correction",
        failure_type: "premature_clarification",
        incorrect_key: "full_form_433_package",
        preferred_key: "notice_code",
        note_key: "identify_notice_first",
        lesson_id: TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id,
      },
      negative_lesson_ids: [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id],
    }),
    institutionalProductionPattern({
      source_digest: PACKAGE_S_THIN_DEBT_DIGEST,
      decision_target: "identify_available_pathways",
      workspace: "question_only",
      current_scope: "thin debt — establish amount before relief schema",
      facts_considered: ["balance_due", "asks_for_options"],
      decision_changing_facts: [
        "confirmed_balance",
        "irs_account_transcript",
        "ability_to_pay",
      ],
      facts_not_needed_yet: [
        "full_form_433_package",
        "complete_financial_statement",
      ],
      facts_discarded: [
        "full_form_433_package",
        "complete_financial_statement",
      ],
      pathways_considered: ["installment_agreement"],
      clarification_key: "irs_account_transcript",
      clarification_reason_key: "amount_unknown_before_pathways",
      clarifications_suppressed: ["full_form_433_package"],
      correction: {
        origin: "consultant_correction",
        failure_type: "premature_clarification",
        incorrect_key: "full_form_433_package",
        preferred_key: "irs_account_transcript",
        note_key: "transcript_before_cis",
        lesson_id: TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id,
      },
      negative_lesson_ids: [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id],
    }),
  ];
}

export type SeedProductionPatternsResult = {
  upserted: number;
  digests: string[];
};

/**
 * Upsert curated L4 patterns by sourceDigest. Idempotent; never invents asks.
 * Does not auto-promote customer traffic — institutional seed only.
 */
export async function seedCuratedProductionPatterns(): Promise<SeedProductionPatternsResult> {
  const patterns = curatedProductionPatterns();
  const digests: string[] = [];
  for (const pattern of patterns) {
    assertSafeForSharedExperience(pattern);
    const existing = await db.experienceObservation.findFirst({
      where: { sourceDigest: pattern.source_digest },
      orderBy: { createdAt: "asc" },
    });
    const data = {
      sourceDigest: pattern.source_digest,
      decisionTarget: pattern.decision_target,
      workspace: pattern.workspace,
      promotionLevel: 4,
      anonJson: JSON.stringify(pattern),
      staleAt: null,
      staleReason: "",
    };
    if (existing) {
      await db.experienceObservation.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await db.experienceObservation.create({ data });
    }
    digests.push(pattern.source_digest);
  }
  return { upserted: digests.length, digests };
}
