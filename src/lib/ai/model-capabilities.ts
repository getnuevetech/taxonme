/**
 * Model Responsibility Contract — which roles may do what.
 * Package I: PRIMARY_REASONING may refine low-confidence question contracts only.
 * Document facts and authority claims are never invented here.
 */

export const MODEL_ROLES = {
  PRIMARY_REASONING: "primary_reasoning",
  FAST_PRESENTER: "fast_presenter",
  DOCUMENT_EXTRACTOR: "document_extractor",
} as const;

export type ModelRole = (typeof MODEL_ROLES)[keyof typeof MODEL_ROLES];

/** Decision targets the reasoning enricher may emit (allowlist). */
export const ALLOWED_DECISION_TARGETS = [
  "comprehensive_case_strategy",
  "explain_document_or_notice",
  "petition_eligibility_overview",
  "document_checklist",
  "identify_available_pathways",
  "status_guidance",
  "risk_overview",
  "answer_user_question",
  "interpret_situation_offer_next_step",
] as const;

export type AllowedDecisionTarget = (typeof ALLOWED_DECISION_TARGETS)[number];

/** Below this routing confidence, optional PRIMARY_REASONING refine may run. */
export const REASONING_ENRICH_CONFIDENCE_CEILING = 0.8;

export function isAllowedDecisionTarget(value: string): value is AllowedDecisionTarget {
  return (ALLOWED_DECISION_TARGETS as readonly string[]).includes(value);
}

export function shouldAttemptReasoningEnrichment(input: {
  routing_confidence: number;
  clarify_first_required?: boolean;
}): boolean {
  if (input.clarify_first_required) return true;
  return input.routing_confidence < REASONING_ENRICH_CONFIDENCE_CEILING;
}

/** Role → allowed surface (documentation + gates). */
export const ROLE_CAPABILITIES: Record<
  ModelRole,
  { may_refine_contract: boolean; may_invent_document_facts: boolean; may_state_authority: boolean }
> = {
  [MODEL_ROLES.PRIMARY_REASONING]: {
    may_refine_contract: true,
    may_invent_document_facts: false,
    may_state_authority: false,
  },
  [MODEL_ROLES.FAST_PRESENTER]: {
    may_refine_contract: false,
    may_invent_document_facts: false,
    may_state_authority: false,
  },
  [MODEL_ROLES.DOCUMENT_EXTRACTOR]: {
    may_refine_contract: false,
    may_invent_document_facts: false,
    may_state_authority: false,
  },
};
