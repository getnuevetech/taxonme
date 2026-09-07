/**
 * Package M — ConversationIntelligence diagnostics view model (admin ops).
 * Read-only summarization; never mutates snapshots.
 */
import type { ConversationIntelligence } from "./types";
import { parseStoredIntelligence } from "./intelligence";
import { intelligenceForCase } from "./need-to-know-clarify";

export type IntelligenceDiagnosticsSummary = {
  decision_target: string;
  interpreted_question: string;
  explicit_question: string;
  response_mode: string;
  pipeline: string;
  workspace: string;
  invokes_case_engine: boolean;
  routing_confidence: number;
  clarify_first_required: boolean;
  ask_now: { question: string; tier: string; reason: string }[];
  clarification_selected: string | null;
  clarification_reason: string | null;
  questions_suppressed: string[];
  source: "stored" | "recomputed";
};

export function summarizeConversationIntelligence(
  intel: ConversationIntelligence,
  source: "stored" | "recomputed" = "stored",
): IntelligenceDiagnosticsSummary {
  return {
    decision_target: intel.question_contract.decision_target,
    interpreted_question: intel.question_contract.interpreted_question,
    explicit_question: intel.question_contract.explicit_question,
    response_mode: intel.route.response_mode,
    pipeline: intel.route.pipeline,
    workspace: intel.route.workspace,
    invokes_case_engine: intel.route.invokes_case_engine,
    routing_confidence: intel.intent.routing_confidence,
    clarify_first_required: intel.answerability.clarify_first_required,
    ask_now: intel.strategy.ask_now.map((item) => ({
      question: item.question,
      tier: item.tier,
      reason: item.reason,
    })),
    clarification_selected: intel.learning_event.clarification_selected,
    clarification_reason: intel.learning_event.clarification_reason,
    questions_suppressed: [...intel.learning_event.questions_suppressed],
    source,
  };
}

export function summarizeFromStoredJson(
  raw: string | null | undefined,
): IntelligenceDiagnosticsSummary | null {
  const intel = parseStoredIntelligence(raw);
  if (!intel) return null;
  return summarizeConversationIntelligence(intel, "stored");
}

/** Case: prefer origin Situation snapshot; else recompute from narrative. */
export function summarizeForCase(opts: {
  situation: string;
  goal: string;
  intelligenceJson?: string | null;
}): IntelligenceDiagnosticsSummary {
  const stored = parseStoredIntelligence(opts.intelligenceJson);
  const intel = intelligenceForCase(opts);
  return summarizeConversationIntelligence(intel, stored ? "stored" : "recomputed");
}
