/**
 * Phase −1.9 L3 — consultant corrections become de-identified candidates.
 */
import type { WorkspaceId } from "../conversation/types";
import type { ExperienceRecordV0 } from "./experience-record";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  textLooksLikePii,
  type AnonymizedCorrection,
  type AnonymizedExperienceRecord,
  type PromotionLevel,
} from "./deidentify";
import { TAX_RELIEF_SCHEMA_NEGATIVE_LESSON } from "./negative-lessons";

export const CORRECTION_FAILURE_TYPES = [
  "premature_clarification",
  "wrong_workspace",
  "wrong_pathway",
  "missed_decision_fact",
  "incorrect_decision_target",
  "other",
] as const;
export type CorrectionFailureType =
  (typeof CORRECTION_FAILURE_TYPES)[number];

export type ConsultantCorrectionInput = {
  failure_type: CorrectionFailureType;
  incorrect_key: string;
  preferred_key: string;
  note_key: string;
  lesson_id?: string | null;
  corrected_decision_target?: string;
  corrected_workspace?: WorkspaceId;
};

export type ReviewerCorrection = {
  origin: "consultant_correction";
  note: string;
  failure_type: CorrectionFailureType;
  incorrect_key: string;
  preferred_key: string;
  lesson_id: string | null;
};

export const PATTERN_CANDIDATE_LEVEL: PromotionLevel = 1;
const KEY_RE = /^[a-z][a-z0-9_]{1,64}$/;

export function isInstitutionalKey(value: string): boolean {
  return KEY_RE.test(String(value || "").trim());
}

export function normalizeCorrectionInput(
  raw: ConsultantCorrectionInput,
): ConsultantCorrectionInput {
  const failure_type = CORRECTION_FAILURE_TYPES.includes(raw.failure_type)
    ? raw.failure_type
    : "other";
  const incorrect_key = String(raw.incorrect_key || "").trim().toLowerCase();
  const preferred_key = String(raw.preferred_key || "").trim().toLowerCase();
  const note_key = String(raw.note_key || "").trim().toLowerCase();
  const lesson_id = raw.lesson_id ? String(raw.lesson_id).trim() : null;

  for (const [label, value] of [
    ["incorrect_key", incorrect_key],
    ["preferred_key", preferred_key],
    ["note_key", note_key],
  ] as const) {
    if (!isInstitutionalKey(value)) {
      throw new Error(
        `${label} must be an institutional snake_case key.`,
      );
    }
    if (textLooksLikePii(value)) {
      throw new Error("Correction keys must not contain PII-like patterns.");
    }
  }
  if (lesson_id && textLooksLikePii(lesson_id)) {
    throw new Error("lesson_id must not contain PII-like patterns.");
  }

  return {
    failure_type,
    incorrect_key,
    preferred_key,
    note_key,
    lesson_id,
    corrected_decision_target: raw.corrected_decision_target
      ? String(raw.corrected_decision_target).trim()
      : undefined,
    corrected_workspace: raw.corrected_workspace,
  };
}

export function inferLessonId(
  correction: ConsultantCorrectionInput,
): string | null {
  if (correction.lesson_id) return correction.lesson_id;
  if (
    correction.failure_type === "premature_clarification" &&
    (correction.incorrect_key === "full_form_433_package" ||
      correction.incorrect_key === "complete_financial_statement") &&
    correction.preferred_key === "ability_to_pay"
  ) {
    return TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id;
  }
  return null;
}

export function applyConsultantCorrection(
  record: ExperienceRecordV0,
  raw: ConsultantCorrectionInput,
): ExperienceRecordV0 {
  const correction = normalizeCorrectionInput(raw);
  const lesson_id = inferLessonId(correction);
  const discarded = unique([
    ...(record.facts_discarded ?? record.facts_not_needed_yet ?? []),
    correction.incorrect_key,
  ]).filter((key) => key !== correction.preferred_key);

  return {
    ...record,
    decision_target:
      correction.corrected_decision_target || record.decision_target,
    workspace: correction.corrected_workspace || record.workspace,
    question_contract: {
      ...record.question_contract,
      decision_target:
        correction.corrected_decision_target ||
        record.question_contract.decision_target,
    },
    facts_considered: unique([
      ...record.facts_considered,
      correction.incorrect_key,
      correction.preferred_key,
    ]),
    decision_changing_facts: unique([
      ...record.decision_changing_facts.filter(
        (key) => key !== correction.incorrect_key,
      ),
      correction.preferred_key,
    ]),
    facts_discarded: discarded,
    facts_not_needed_yet: discarded,
    clarifications_suppressed: unique([
      ...record.clarifications_suppressed,
      correction.incorrect_key,
    ]),
    reviewer_correction: {
      origin: "consultant_correction",
      note: correction.note_key,
      failure_type: correction.failure_type,
      incorrect_key: correction.incorrect_key,
      preferred_key: correction.preferred_key,
      lesson_id,
    },
    negative_lesson_ids: unique([
      ...record.negative_lesson_ids,
      ...(lesson_id ? [lesson_id] : []),
    ]),
    capture_enrichment: "l2",
  };
}

export function correctionToAnon(
  correction: ReviewerCorrection,
): AnonymizedCorrection {
  return {
    origin: "consultant_correction",
    failure_type: correction.failure_type,
    incorrect_key: correction.incorrect_key,
    preferred_key: correction.preferred_key,
    note_key: correction.note,
    lesson_id: correction.lesson_id,
  };
}

export function buildPatternCandidate(
  record: ExperienceRecordV0,
  opts?: { sourceId?: string },
): AnonymizedExperienceRecord {
  if (
    !record.reviewer_correction ||
    record.reviewer_correction.origin !== "consultant_correction"
  ) {
    throw new Error(
      "Pattern candidate requires a consultant reviewer_correction.",
    );
  }
  const candidate: AnonymizedExperienceRecord = {
    ...deidentifyExperienceRecord(record, opts),
    promotion_level: PATTERN_CANDIDATE_LEVEL,
    has_reviewer_correction: true,
    correction: correctionToAnon(
      record.reviewer_correction as ReviewerCorrection,
    ),
    origin: "consultant_correction",
  };
  assertSafeForSharedExperience(candidate);
  return candidate;
}

export function assertIsPatternCandidate(
  anon: AnonymizedExperienceRecord,
): void {
  assertSafeForSharedExperience(anon);
  if (
    anon.promotion_level !== PATTERN_CANDIDATE_LEVEL ||
    anon.origin !== "consultant_correction" ||
    !anon.correction
  ) {
    throw new Error(
      "Correction candidate must be level 1 with correction provenance.",
    );
  }
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
