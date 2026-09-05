/**
 * Package A — goal provenance.
 * USER_REPORTED_GOAL is immutable. Models may interpret outcomes/options separately;
 * they must never overwrite what the customer stated.
 */
import { normalizeConcept } from "@/lib/case-semantics";

const MECHANISM_AS_GOAL =
  /\b(first[- ]?time abatement|fta|aep|penalty\s*relief|reduc\w*\s+penalties?|abatement|installment agreement|form\s*9465|offer in compromise|oic|payment plan)\b/i;

export type GoalFacts = {
  user_reported_goal: string;
  user_goal: string;
  primary_goal?: string;
  secondary_goals?: string[];
  interpreted_objective?: string;
  possible_desired_outcomes?: string[];
  potential_resolution_options?: string[];
  normalized_goal_categories?: string[];
  appears_possible?: string;
  [key: string]: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => asString(v)).filter(Boolean);
}

/** Strip mechanism-as-goal phrasing from interpreted primary goal text. */
export function demoteMechanismGoal(text: string, userGoal: string): string {
  const cleaned = text.trim();
  if (!cleaned) return userGoal.trim();
  if (MECHANISM_AS_GOAL.test(cleaned) && !MECHANISM_AS_GOAL.test(userGoal)) {
    // Model invented a mechanism the user did not state as their goal.
    return userGoal.trim() || cleaned;
  }
  return cleaned;
}

/**
 * Lock user-reported goal; keep model interpretation in separate fields.
 */
export function preserveUserReportedGoal(
  userGoal: string,
  modelMerged: Record<string, unknown> | null | undefined,
): GoalFacts {
  const reported = (userGoal || "").trim();
  const model = modelMerged ?? {};
  const modelPrimary = asString(model.primary_goal) || asString(model.user_goal);
  const interpreted = demoteMechanismGoal(modelPrimary, reported);

  const categories = asStringArray(model.normalized_goal_categories);
  if (reported && categories.length === 0) {
    const concept = normalizeConcept(reported);
    if (concept.normalized_category !== "UNCLASSIFIED") {
      categories.push(concept.normalized_category);
    }
  }

  const resolutionOptions = [
    ...asStringArray(model.potential_resolution_options),
    ...asStringArray(model.secondary_goals).filter((g) => MECHANISM_AS_GOAL.test(g)),
  ];
  const uniqueOptions = [...new Set(resolutionOptions)];

  return {
    ...model,
    user_reported_goal: reported,
    user_goal: reported,
    primary_goal: interpreted || reported,
    interpreted_objective: interpreted || reported,
    possible_desired_outcomes: asStringArray(model.possible_desired_outcomes).length
      ? asStringArray(model.possible_desired_outcomes)
      : interpreted && interpreted !== reported
        ? [interpreted]
        : [],
    potential_resolution_options: uniqueOptions,
    normalized_goal_categories: categories,
    appears_possible: asString(model.appears_possible) || undefined,
  };
}
