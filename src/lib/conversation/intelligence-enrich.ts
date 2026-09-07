/**
 * Package I — pure enrichment helpers (experience ask hints + allowlisted contract refine).
 * Never invents document facts; never invents need-to-know questions from patterns alone.
 */
import { isAllowedDecisionTarget } from "@/lib/ai/model-capabilities";
import type { ConversationIntelligence, NeedToKnowItem, QuestionContract } from "./types";

export type ExperienceAskHints = {
  suppress_keys: string[];
  prefer_keys: string[];
  negative_lesson_ids: string[];
};

export type ContractRefinePatch = {
  interpreted_question?: string;
  decision_target?: string;
};

function itemMatchesKey(item: NeedToKnowItem, key: string): boolean {
  const needle = key.toLowerCase().replace(/_/g, " ");
  const hay = [
    item.question,
    item.reason,
    ...item.branches_affected,
    key,
  ]
    .join(" ")
    .toLowerCase();
  if (hay.includes(needle)) return true;
  // ability_to_pay ↔ monthly payment / afford
  if (key === "ability_to_pay" && /\b(monthly|afford|pay|hardship|collectible)\b/i.test(item.question)) {
    return true;
  }
  if (
    (key === "notice_code" || key === "collection_notice") &&
    /\b(notice|cp\s?-?\d|lt\s?-?\d)\b/i.test(item.question)
  ) {
    return true;
  }
  if (
    (key === "confirmed_balance" || key === "irs_account_transcript" || key === "account_transcript") &&
    /\b(balance|transcript|account|how much)\b/i.test(item.question)
  ) {
    return true;
  }
  if (key === "tax_year" && /\b(tax year|year)\b/i.test(item.question)) return true;
  return false;
}

/**
 * Reorder / filter ask candidates from production pattern hints.
 * Pool = existing ask_now plus other critical_now+changes_branch need-to-know items.
 * Does not invent new questions — only prefer/suppress among heuristic candidates.
 */
export function applyExperienceAskHints(
  intel: ConversationIntelligence,
  hints: ExperienceAskHints,
): ConversationIntelligence {
  if (!hints.prefer_keys.length && !hints.suppress_keys.length) return intel;

  const fromNeed = intel.need_to_know.filter(
    (q) => q.tier === "critical_now" && q.changes_branch,
  );
  const seen = new Set<string>();
  const pool: NeedToKnowItem[] = [];
  for (const item of [...intel.strategy.ask_now, ...fromNeed]) {
    const key = item.question;
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(item);
  }
  if (!pool.length) return intel;

  const suppressed = pool.filter(
    (item) => !hints.suppress_keys.some((key) => itemMatchesKey(item, key)),
  );
  const preferred = suppressed.filter((item) =>
    hints.prefer_keys.some((key) => itemMatchesKey(item, key)),
  );
  const rest = suppressed.filter((item) => !preferred.includes(item));
  const nextAsk = [...preferred, ...rest].slice(0, 1);
  const modeAsk = intel.strategy.mode === "answer" ? [] : nextAsk;
  const priorFirst = intel.strategy.ask_now[0]?.question ?? "";
  if (modeAsk.length === intel.strategy.ask_now.length && modeAsk[0]?.question === priorFirst) {
    return intel;
  }

  return {
    ...intel,
    strategy: {
      ...intel.strategy,
      ask_now: modeAsk,
    },
    learning_event: {
      ...intel.learning_event,
      clarification_selected: modeAsk[0]?.question ?? intel.learning_event.clarification_selected,
      clarification_reason: modeAsk[0]
        ? `experience_prefer:${hints.prefer_keys.slice(0, 3).join(",") || "reorder"}`
        : intel.learning_event.clarification_reason,
      questions_suppressed: [
        ...new Set([
          ...intel.learning_event.questions_suppressed,
          ...pool.filter((q) => !modeAsk.includes(q)).map((q) => q.question),
        ]),
      ],
    },
  };
}

/** Apply allowlisted contract label refine; reject unknown decision_target. */
export function applyContractRefine(
  intel: ConversationIntelligence,
  patch: ContractRefinePatch | null | undefined,
): ConversationIntelligence {
  if (!patch) return intel;
  const interpreted = String(patch.interpreted_question ?? "").trim();
  const target = String(patch.decision_target ?? "").trim();
  if (!interpreted && !target) return intel;

  const nextContract: QuestionContract = { ...intel.question_contract };
  if (interpreted && interpreted.length >= 12 && interpreted.length <= 500) {
    nextContract.interpreted_question = interpreted;
  }
  if (target && isAllowedDecisionTarget(target)) {
    nextContract.decision_target = target;
  }

  if (
    nextContract.interpreted_question === intel.question_contract.interpreted_question &&
    nextContract.decision_target === intel.question_contract.decision_target
  ) {
    return intel;
  }

  return {
    ...intel,
    question_contract: nextContract,
    intent: {
      ...intel.intent,
      question: nextContract.interpreted_question || intel.intent.question,
    },
    learning_event: {
      ...intel.learning_event,
      question_contract: nextContract,
      decision_target: nextContract.decision_target,
    },
  };
}

/** Parse model JSON that may refine contract labels only. */
export function parseContractRefineResponse(raw: string): ContractRefinePatch | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const interpreted_question =
      typeof parsed.interpreted_question === "string" ? parsed.interpreted_question : undefined;
    const decision_target =
      typeof parsed.decision_target === "string" ? parsed.decision_target : undefined;
    if (!interpreted_question && !decision_target) return null;
    return { interpreted_question, decision_target };
  } catch {
    return null;
  }
}
