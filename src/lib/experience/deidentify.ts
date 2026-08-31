/**
 * Phase −1.9 L1 — de-identify owner-scoped experience before shared storage.
 */
import type { QuestionContract } from "../conversation/types";
import type { ExperienceRecordV0 } from "./experience-record";

const PII_PATTERNS: RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b\d{2}-\d{7}\b/,
  /\b(?:ptin\s*)?P\d{8}\b/i,
  /\b(?:irs\s+)?account\s*(?:number|no\.?|#)\s*[:#-]?\s*\d{6,}\b/i,
  /\b\d{1,5}\s+\w+\s+(street|st|ave|avenue|rd|road|blvd|lane|ln|dr|drive)\b/i,
];

export type AnonymizedNegativeLearning = {
  lesson_id: string;
  evaluation: "avoided" | "violated" | "not_applicable";
  incorrect_ask_detected: boolean;
  preferred_fact_asked: boolean;
  situation_features_matched: string[];
  failure_type: string;
};

export type PromotionLevel = 0 | 1 | 2 | 3 | 4;

export type AnonymizedCorrection = {
  origin: "consultant_correction";
  failure_type: string;
  incorrect_key: string;
  preferred_key: string;
  note_key: string;
  lesson_id: string | null;
};

export type AnonymizedOutcome = {
  origin: "government_outcome";
  outcome_kind: string;
  government_system: string;
  form_or_notice_key: string;
  authority_keys: string[];
  authority_publisher: string;
  note_key: string;
  signal_precedence: "historical_experience";
  outranked_by: "current_authority";
};

export type AnonymizedExperienceRecord = {
  schema_version: "l1_anon";
  workspace: ExperienceRecordV0["workspace"];
  decision_target: string;
  current_scope: string;
  facts_considered: string[];
  decision_changing_facts: string[];
  facts_not_needed_yet: string[];
  facts_discarded: string[];
  pathways_considered: string[];
  clarification_key: string | null;
  clarification_reason_key: string | null;
  clarifications_suppressed: string[];
  document_kinds: string[];
  authority_ids: string[];
  answer_changed_after_clarification: boolean;
  has_model_correction: boolean;
  has_reviewer_correction: boolean;
  outcome_kind: string | null;
  response_mode: ExperienceRecordV0["response_mode"];
  invokes_case_engine: boolean;
  existing_government_case: boolean;
  interaction_intent: ExperienceRecordV0["interaction_intent"];
  negative_lesson_ids: string[];
  negative_learning: AnonymizedNegativeLearning[];
  capture_enrichment: "l2" | "l0";
  source_digest: string;
  promotion_level: PromotionLevel;
  origin?: "turn" | "consultant_correction" | "government_outcome";
  correction?: AnonymizedCorrection;
  outcome?: AnonymizedOutcome;
};

export function textLooksLikePii(text: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(String(text || "")));
}

export function scrubFreeText(text: string): string {
  let output = String(text || "");
  for (const pattern of PII_PATTERNS) {
    output = output.replace(pattern, "[redacted]");
  }
  return output.length > 120 ? `${output.slice(0, 117)}...` : output;
}

function documentKindFromHint(name: string): string {
  const lower = name.toLowerCase();
  if (/\bcp\s?-?\d{3,4}\b|\blt\s?-?\d+\b|notice/.test(lower)) {
    return "collection_notice";
  }
  if (/form\s*433|f433/.test(lower)) return "collection_information_statement";
  if (/form\s*9465|f9465/.test(lower)) return "installment_agreement_request";
  if (/transcript/.test(lower)) return "tax_transcript";
  if (/\.pdf$/i.test(lower)) return "pdf";
  if (/\.(png|jpe?g|heic)$/i.test(lower)) return "image";
  return "document";
}

function reasonKey(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const lower = reason.toLowerCase();
  if (/installment|currently not collectible|relief path|branch/.test(lower)) {
    return "changes_relief_pathway";
  }
  if (/notice|form number|identify/.test(lower)) return "identifies_notice";
  if (/collection|levy/.test(lower)) return "affects_collection_stage";
  return "decision_relevant";
}

function contractAnon(
  contract: QuestionContract,
): Pick<QuestionContract, "decision_target" | "current_scope"> {
  return {
    decision_target: contract.decision_target,
    current_scope: contract.current_scope,
  };
}

export function sourceDigest(seed: string): string {
  let hash = 2166136261;
  for (const char of `taxonme-exp-l1:${seed}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `d${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function deidentifyExperienceRecord(
  record: ExperienceRecordV0,
  opts?: { sourceId?: string },
): AnonymizedExperienceRecord {
  const scope = contractAnon(record.question_contract);
  const discarded =
    record.facts_discarded ?? record.facts_not_needed_yet ?? [];
  return {
    schema_version: "l1_anon",
    workspace: record.workspace,
    decision_target: scope.decision_target,
    current_scope: scope.current_scope,
    facts_considered: [...record.facts_considered],
    decision_changing_facts: [...record.decision_changing_facts],
    facts_not_needed_yet: [...record.facts_not_needed_yet],
    facts_discarded: [...discarded],
    pathways_considered: [...record.pathways_considered],
    clarification_key: record.clarification_selected?.key ?? null,
    clarification_reason_key: reasonKey(record.clarification_selected?.reason),
    clarifications_suppressed: [...record.clarifications_suppressed],
    document_kinds: (record.documents_used ?? []).map(documentKindFromHint),
    authority_ids: [...record.authority_ids],
    answer_changed_after_clarification:
      record.answer_changed_after_clarification,
    has_model_correction: Boolean(record.model_correction),
    has_reviewer_correction: Boolean(record.reviewer_correction),
    outcome_kind: record.outcome?.kind ?? null,
    response_mode: record.response_mode,
    invokes_case_engine: record.invokes_case_engine,
    existing_government_case: record.existing_government_case,
    interaction_intent: record.interaction_intent,
    negative_lesson_ids: [...record.negative_lesson_ids],
    negative_learning: (record.negative_learning_records ?? []).map(
      (item) => ({
        lesson_id: item.lesson_id,
        evaluation: item.evaluation,
        incorrect_ask_detected: item.incorrect_ask_detected,
        preferred_fact_asked: item.preferred_fact_asked,
        situation_features_matched: [...item.situation_features_matched],
        failure_type: item.failure_type,
      }),
    ),
    capture_enrichment: record.capture_enrichment ?? "l0",
    source_digest: sourceDigest(
      opts?.sourceId || `${record.decision_target}:${record.workspace}`,
    ),
    promotion_level: 0,
    origin: "turn",
  };
}

export function assertSafeForSharedExperience(
  anon: AnonymizedExperienceRecord,
): void {
  const blob = JSON.stringify(anon);
  if (textLooksLikePii(blob)) {
    throw new Error(
      "Anonymized experience still contains PII-like patterns; refusing shared publish.",
    );
  }
  if ("question_contract" in (anon as object)) {
    throw new Error("Shared experience must not include raw question_contract.");
  }
  if ((anon as { clarification_selected?: unknown }).clarification_selected) {
    throw new Error(
      "Shared experience must not include free-text clarification_selected.",
    );
  }
}

export function filterForCrossUserRead(
  records: Array<{
    ownerUserId: string | null;
    raw: ExperienceRecordV0;
    anon: AnonymizedExperienceRecord;
  }>,
  viewerUserId: string | null,
): AnonymizedExperienceRecord[] {
  void viewerUserId;
  return records.map((row) => {
    void row.ownerUserId;
    assertSafeForSharedExperience(row.anon);
    return row.anon;
  });
}
