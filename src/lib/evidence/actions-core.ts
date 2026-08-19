import { normalizeActionPurpose } from "../case-semantics";
import { FACT_KEYS, isEvidentiaryProvenance } from "./types";
import type { KnownFact } from "./unknowns";

// Action intelligence. An investigation the evidence has already completed must
// not be shown to the customer as something they still need to do, and the same
// intent stated three different ways is one action.

export const ACTION_STATES = {
  BLOCKED: "BLOCKED",
  READY: "READY",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  SUPERSEDED: "SUPERSEDED",
  NOT_REQUIRED: "NOT_REQUIRED",
} as const;

export type ActionState = (typeof ACTION_STATES)[keyof typeof ACTION_STATES];

// What each normalized purpose would establish, and therefore what evidence
// would make it unnecessary to ask for.
const PURPOSE_EVIDENCE: Record<string, string[]> = {
  VERIFY_NOTICE: [FACT_KEYS.NOTICE_CODE],
  VERIFY_TRANSCRIPT: [FACT_KEYS.TRANSCRIPT_ON_FILE],
  OBTAIN_TRANSCRIPT: [FACT_KEYS.TRANSCRIPT_ON_FILE],
  VERIFY_AMOUNT: [FACT_KEYS.ACCOUNT_BALANCE],
  VERIFY_DEADLINE: [FACT_KEYS.NOTICE_DEADLINE],
};

const PURPOSE_REQUIREMENTS: Record<string, string[]> = {
  VERIFY_NOTICE: ["IRS notice or letter"],
  VERIFY_TRANSCRIPT: ["IRS account transcript"],
  OBTAIN_TRANSCRIPT: ["IRS online account access"],
  VERIFY_AMOUNT: ["IRS account transcript or notice stating the balance"],
  VERIFY_DEADLINE: ["IRS notice stating the response deadline"],
  GET_PROFESSIONAL_REVIEW: ["Professional review availability"],
};

export type ActionStepInput = {
  id: string;
  actionKey: string;
  title: string;
  description: string;
  status: string;
  sortOrder: number;
};

export type ActionNodeInput = {
  sourceStepId: string;
  actionKey: string;
  normalizedPurpose: string;
  title: string;
  description: string;
  priority: number;
  dependsOnStepIds: string[];
  resolves: string[];
  requires: string[];
  status: ActionState;
  satisfiedByFactIds: string[];
};

export function actionSatisfiedByEvidence(
  purpose: string,
  facts: KnownFact[],
): { satisfied: boolean; factIds: string[] } {
  const required = PURPOSE_EVIDENCE[purpose];
  if (!required) return { satisfied: false, factIds: [] };
  const matches = facts.filter(
    (fact) =>
      required.includes(fact.factKey) &&
      isEvidentiaryProvenance(fact.provenance) &&
      (String(fact.valueText ?? "").trim() !== "" || typeof fact.valueNumber === "number"),
  );
  return { satisfied: matches.length > 0, factIds: matches.map((fact) => fact.id ?? "").filter(Boolean) };
}

export function buildActionGraph(
  steps: ActionStepInput[],
  facts: KnownFact[],
  caseFlags: { professionalReviewRecommended: boolean } = { professionalReviewRecommended: false },
): ActionNodeInput[] {
  const ordered = [...steps].sort((a, b) => a.sortOrder - b.sortOrder).filter((step) => step.title && step.description);
  const seenPurpose = new Map<string, string>();
  const nodes: ActionNodeInput[] = [];
  let priority = 0;
  let previousUnfinishedStepId: string | null = null;

  for (const step of ordered) {
    const purpose = normalizeActionPurpose(`${step.actionKey} ${step.title} ${step.description}`);
    const evidence = actionSatisfiedByEvidence(purpose, facts);

    // The same intent stated twice is one action; the repeat is kept as history.
    if (seenPurpose.has(purpose)) {
      nodes.push({
        sourceStepId: step.id,
        actionKey: step.actionKey || purpose,
        normalizedPurpose: purpose,
        title: step.title,
        description: step.description,
        priority: 0,
        dependsOnStepIds: [],
        resolves: PURPOSE_EVIDENCE[purpose] ?? [],
        requires: PURPOSE_REQUIREMENTS[purpose] ?? [],
        status: ACTION_STATES.SUPERSEDED,
        satisfiedByFactIds: [],
      });
      continue;
    }
    seenPurpose.set(purpose, step.id);

    const notRequired = purpose === "GET_PROFESSIONAL_REVIEW" && !caseFlags.professionalReviewRecommended;
    const completed = step.status === "done" || evidence.satisfied;
    const dependsOn = previousUnfinishedStepId ? [previousUnfinishedStepId] : [];

    const status: ActionState = notRequired
      ? ACTION_STATES.NOT_REQUIRED
      : completed
        ? ACTION_STATES.COMPLETED
        : dependsOn.length > 0
          ? ACTION_STATES.BLOCKED
          : step.status === "current"
            ? ACTION_STATES.READY
            : ACTION_STATES.READY;

    priority += 1;
    nodes.push({
      sourceStepId: step.id,
      actionKey: step.actionKey || purpose,
      normalizedPurpose: purpose,
      title: step.title,
      description: step.description,
      priority,
      dependsOnStepIds: dependsOn,
      resolves: PURPOSE_EVIDENCE[purpose] ?? [],
      requires: PURPOSE_REQUIREMENTS[purpose] ?? [],
      status,
      satisfiedByFactIds: evidence.factIds,
    });

    // Only work the customer still has to do can block what follows.
    if (status !== ACTION_STATES.COMPLETED && status !== ACTION_STATES.NOT_REQUIRED) {
      previousUnfinishedStepId = step.id;
    }
  }

  return nodes;
}

// The customer's path forward is what is left to do, in order.
export function openActions(nodes: ActionNodeInput[]): ActionNodeInput[] {
  return nodes
    .filter((node) => node.status === ACTION_STATES.READY || node.status === ACTION_STATES.BLOCKED || node.status === ACTION_STATES.IN_PROGRESS)
    .sort((a, b) => a.priority - b.priority);
}
