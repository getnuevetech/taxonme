import { z } from "zod";
import { STAGE_KEYS } from "../constants";

type Json = Record<string, unknown>;

export type AiValidationResult = {
  ok: boolean;
  qualityGate: "PASS" | "FAIL";
  error: string;
};

const objectSchema = z.object({}).passthrough();

function hasAnyKey(data: Json, keys: string[]): boolean {
  return keys.some((key) => data[key] !== undefined && data[key] !== null && data[key] !== "");
}

const stageValidators: Record<string, (data: Json) => boolean> = {
  [STAGE_KEYS.SUMMARY]: (data) => hasAnyKey(data, ["situation_summary", "tax_years", "issues_reported", "unknowns", "claimed_balances"]),
  [STAGE_KEYS.GOAL]: (data) => hasAnyKey(data, ["primary_goal", "normalized_goal_categories", "appears_possible", "user_goal", "desired_outcomes"]),
  [STAGE_KEYS.DOCUMENT]: (data) => hasAnyKey(data, ["document_type", "document_identification", "field_comparison", "verified_fields", "verification_required"]),
  [STAGE_KEYS.SITUATION]: (data) => Array.isArray(data.issues) || hasAnyKey(data, ["case_status", "approved_findings", "review_result"]),
  [STAGE_KEYS.PRESENTER]: (data) => Array.isArray(data.issues) || typeof data.finding_card === "object",
  [STAGE_KEYS.QA]: (data) => typeof data.answer === "string" || Array.isArray(data.claims) || Array.isArray(data.issues),
  [STAGE_KEYS.NOTICE]: (data) => hasAnyKey(data, ["notice_type", "notice_identity", "what_it_means", "plain_english_explanation"]),
  [STAGE_KEYS.LETTER]: (data) => hasAnyKey(data, ["letter_text", "review_result", "claims"]),
  [STAGE_KEYS.GUIDE]: (data) => typeof data.answer === "string" || typeof data.message === "string",
  [STAGE_KEYS.MATCH]: (data) => Array.isArray(data.ranked_candidates) || Array.isArray(data.approved_ranking) || typeof data.consultant_id === "string",
  [STAGE_KEYS.MATCH_REASON]: (data) => hasAnyKey(data, ["summary", "customer_summary", "detailed_reason", "detailed_fit_reasons"]),
  [STAGE_KEYS.CLOSING]: (data) => hasAnyKey(data, ["closure_reason", "closing_remarks", "customer_summary"]),
};

export function validateAiJson(stageKey: string, data: Json | null): AiValidationResult {
  if (!data) return { ok: false, qualityGate: "FAIL", error: "No parseable JSON object returned." };
  const parsed = objectSchema.safeParse(data);
  if (!parsed.success) return { ok: false, qualityGate: "FAIL", error: parsed.error.issues[0]?.message ?? "Invalid JSON object." };
  const validates = stageValidators[stageKey];
  if (validates && !validates(parsed.data)) {
    return {
      ok: false,
      qualityGate: "FAIL",
      error: `Output did not match the ${stageKey} stage contract.`,
    };
  }
  return { ok: true, qualityGate: "PASS", error: "" };
}

export function extractUserFacingText(data: Json | null, rawText: string): string {
  if (!data) return rawText.trim();
  const candidates = [
    data.answer,
    data.message,
    data.customer_summary,
    data.summary,
    data.letter_text,
    data.closing_remarks,
    data.what_it_means,
    data.plain_english_explanation,
  ];
  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return typeof found === "string" ? found.trim() : rawText.trim();
}
