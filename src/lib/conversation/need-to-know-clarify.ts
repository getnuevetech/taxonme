import { askableNow } from "./need-to-know";
import { helpsDecisionTarget } from "./question-contract";
import { runConversationIntelligence, parseStoredIntelligence } from "./intelligence";
import type { ConversationIntelligence, NeedToKnowItem } from "./types";

export type NeedToKnowClarify = {
  key: string;
  text: string;
  reason: string;
  changes_branch: true;
  tier: "critical_now";
};

/** Prefer Phase −1 need-to-know ask over schema-fill unknowns. */
export function needToKnowClarifyQuestion(
  intel: ConversationIntelligence,
  answeredKeys: string[],
): NeedToKnowClarify | null {
  // Situation / pathway workspaces: never fall through to Case schema completeness.
  const target = intel.question_contract.decision_target;
  const situationLike =
    intel.route?.workspace === "situation" ||
    intel.route?.workspace === "filing_plan" ||
    target === "identify_available_pathways" ||
    target === "petition_eligibility_overview";

  const answered = new Set(answeredKeys);
  const candidates = [...intel.strategy.ask_now, ...askableNow(intel.need_to_know)];
  for (const item of candidates) {
    if (!item.changes_branch || item.tier !== "critical_now") continue;
    if (situationLike && /medical\s*exam|i-?693|priority\s*date|passport|i-?864/i.test(item.question)) {
      continue;
    }
    const key = `need_to_know:${slug(item.question)}`;
    if (answered.has(key) || answered.has(item.question)) continue;
    return {
      key,
      text: item.question,
      reason: item.reason,
      changes_branch: true,
      tier: "critical_now",
    };
  }
  return null;
}

export function intelligenceForCase(opts: {
  situation: string;
  goal: string;
  intelligenceJson?: string | null;
}): ConversationIntelligence {
  const stored = parseStoredIntelligence(opts.intelligenceJson);
  if (stored) return stored;
  return runConversationIntelligence({ message: opts.situation, goal: opts.goal });
}

/** Drop planned unknowns that do not help the current decision target. */
export function unknownHelpsContract(unknownKey: string, intel: ConversationIntelligence): boolean {
  if (helpsDecisionTarget(unknownKey, intel.question_contract)) return true;
  // Map common unknown keys to branch-changing themes
  return intel.need_to_know.some(
    (item) =>
      item.changes_branch &&
      (item.tier === "critical_now" || item.tier === "soon") &&
      item.branches_affected.some((b) => unknownKey.toLowerCase().includes(b.slice(0, 6))),
  );
}

export function rankNeedToKnowForDisplay(items: NeedToKnowItem[]): NeedToKnowItem[] {
  return askableNow(items);
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}
