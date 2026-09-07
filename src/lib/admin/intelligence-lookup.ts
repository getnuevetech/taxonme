import "server-only";
import { db } from "@/lib/db";
import {
  summarizeConversationIntelligence,
  summarizeForCase,
  summarizeFromStoredJson,
  type IntelligenceDiagnosticsSummary,
} from "@/lib/conversation/intelligence-diagnostics";

export type IntelligenceLookupResult = {
  kind: "situation" | "qa_thread" | "case";
  id: string;
  label: string;
  summary: IntelligenceDiagnosticsSummary;
  rawJson: string | null;
};

export async function lookupIntelligenceDiagnostics(
  rawQuery: string,
): Promise<IntelligenceLookupResult | { error: string } | null> {
  const q = rawQuery.trim();
  if (!q) return null;

  // Situation by cuid or SIT-number
  const sitNumber = q.match(/^SIT-?0*(\d+)$/i)?.[1];
  const situation = sitNumber
    ? await db.situation.findFirst({ where: { number: Number(sitNumber) } })
    : await db.situation.findUnique({ where: { id: q } }).catch(() => null);
  if (situation) {
    const summary = summarizeFromStoredJson(situation.intelligenceJson);
    if (!summary) {
      return { error: `Situation ${situation.id} has no parseable intelligenceJson.` };
    }
    return {
      kind: "situation",
      id: situation.id,
      label: `Situation #${situation.number} · ${situation.title}`,
      summary,
      rawJson: situation.intelligenceJson,
    };
  }

  const thread = await db.qaThread.findUnique({ where: { id: q } }).catch(() => null);
  if (thread) {
    const summary = summarizeFromStoredJson(thread.intelligenceJson);
    if (!summary) {
      return { error: `QaThread ${thread.id} has no parseable intelligenceJson.` };
    }
    return {
      kind: "qa_thread",
      id: thread.id,
      label: `Q&A · ${thread.title}`,
      summary,
      rawJson: thread.intelligenceJson,
    };
  }

  const caseRow = await db.case.findUnique({
    where: { id: q },
    include: { originSituation: { select: { intelligenceJson: true, number: true, title: true } } },
  }).catch(() => null);
  if (caseRow) {
    const summary = summarizeForCase({
      situation: caseRow.situation,
      goal: caseRow.goal,
      intelligenceJson: caseRow.originSituation?.intelligenceJson,
    });
    return {
      kind: "case",
      id: caseRow.id,
      label: `Case · ${caseRow.title}${
        caseRow.originSituation ? ` (from Situation #${caseRow.originSituation.number})` : ""
      }`,
      summary,
      rawJson: caseRow.originSituation?.intelligenceJson ?? null,
    };
  }

  return { error: "No Situation, QaThread, or Case matched that id." };
}

export function emptySummaryProbe(): IntelligenceDiagnosticsSummary {
  // Used only by gates — production always loads from DB / intelligenceForCase.
  return summarizeConversationIntelligence(
    {
      question_contract: {
        explicit_question: "",
        interpreted_question: "probe",
        decision_target: "identify_available_pathways",
        current_scope: "",
        user_requested_action: false,
        requires_case_development: false,
      },
      intent: {
        primary_intent: "strategy_comparison",
        interaction_intent: "strategy_question",
        domain: "tax",
        question: "probe",
        recommended_pipeline: "assistant",
        recommended_response_mode: "answer_then_targeted_question",
        recommended_workspace: "situation",
        routing_confidence: 0.8,
        can_answer_partially_now: true,
        requires_personalized_analysis: false,
      },
      answerability: {
        fully_answerable: false,
        partially_answerable: true,
        requires_clarification: false,
        requires_document: false,
        clarify_first_required: false,
        clarify_first_reason: "",
      },
      need_to_know: [],
      strategy: {
        mode: "answer_then_targeted_question",
        branch_before_clarify: true,
        branches: [],
        ask_now: [],
        ask_later: [],
        provisional_answer_outline: [],
      },
      route: {
        pipeline: "assistant",
        workspace: "situation",
        customer_state: "situation",
        response_mode: "answer_then_targeted_question",
        existing_government_case: false,
        invokes_case_engine: false,
        reason: "probe",
        from_recommendation: "assistant",
        confidence: 0.8,
      },
      learning_event: {
        question_contract: {
          explicit_question: "",
          interpreted_question: "probe",
          decision_target: "identify_available_pathways",
          current_scope: "",
          user_requested_action: false,
          requires_case_development: false,
        },
        workspace_selected: "situation",
        decision_target: "identify_available_pathways",
        pathways_considered: [],
        clarification_selected: null,
        clarification_reason: null,
        questions_suppressed: [],
        response_mode: "answer_then_targeted_question",
        invokes_case_engine: false,
        existing_government_case: false,
        interaction_intent: "strategy_question",
      },
    },
    "recomputed",
  );
}
