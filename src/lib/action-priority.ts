/**
 * Phase D — deterministic action priority (tax).
 */

import type { FactLedger } from "@/lib/evidence/fact-ledger";
import { ledgerFact } from "@/lib/evidence/fact-ledger";
import { isCollectionsLevyLock, isCp2000Lock, type MatterTypeLock } from "@/lib/matter-type-lock";

export const ACTION_PRIORITY_WEIGHTS = {
  legal_case_materiality: 3,
  evidence_gap_importance: 3,
  deadline_urgency: 2,
  goal_relevance: 3,
  ability_to_resolve: 2,
} as const;

export type ActionPriorityScores = {
  legal_case_materiality: number;
  evidence_gap_importance: number;
  deadline_urgency: number;
  goal_relevance: number;
  ability_to_resolve: number;
};

export type ActionEffect =
  | { op: "RESOLVE_UNKNOWN"; fact_id: string }
  | { op: "PROMOTE_FACT"; fact_id: string; from: string; to: string };

export type RankedAction = {
  action_id: string;
  title: string;
  why: string;
  what_changes: string;
  actor: "customer" | "system";
  scores: ActionPriorityScores;
  priority_score: number;
  blocks_goal_progress: boolean;
  effects: ActionEffect[];
};

export const GENERIC_ACTION_IDS = new Set([
  "REVIEW_RETURN",
  "ASK_FOLLOW_UP",
  "KEEP_NOTICE",
  "START_NEW_1040",
  "PREPARE_GENERIC_LETTER",
]);

export function computePriorityScore(scores: ActionPriorityScores): number {
  return (
    scores.legal_case_materiality * ACTION_PRIORITY_WEIGHTS.legal_case_materiality +
    scores.evidence_gap_importance * ACTION_PRIORITY_WEIGHTS.evidence_gap_importance +
    scores.deadline_urgency * ACTION_PRIORITY_WEIGHTS.deadline_urgency +
    scores.goal_relevance * ACTION_PRIORITY_WEIGHTS.goal_relevance +
    scores.ability_to_resolve * ACTION_PRIORITY_WEIGHTS.ability_to_resolve
  );
}

export function rankScoredActions<
  T extends {
    action_id: string;
    priority_score: number;
    blocks_goal_progress?: boolean;
    scores: Pick<ActionPriorityScores, "deadline_urgency">;
  },
>(actions: T[]): T[] {
  return [...actions].sort((a, b) => {
    if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
    const aBlock = a.blocks_goal_progress ? 1 : 0;
    const bBlock = b.blocks_goal_progress ? 1 : 0;
    if (bBlock !== aBlock) return bBlock - aBlock;
    if (b.scores.deadline_urgency !== a.scores.deadline_urgency) {
      return b.scores.deadline_urgency - a.scores.deadline_urgency;
    }
    return a.action_id.localeCompare(b.action_id);
  });
}

function scored(partial: Omit<RankedAction, "priority_score"> & { priority_score?: number }): RankedAction {
  return { ...partial, priority_score: partial.priority_score ?? computePriorityScore(partial.scores) };
}

function gapOpen(ledger: FactLedger | null | undefined, factId: string): boolean {
  const f = ledgerFact(ledger, factId);
  return !f || f.status === "UNKNOWN" || f.kind === "EVIDENCE_GAP";
}

export function buildRankedTaxActions(input: {
  ledger?: FactLedger | null;
  lock?: MatterTypeLock | null;
  hasNoticeDeadline?: boolean;
}): RankedAction[] {
  const ledger = input.ledger;
  const lock = input.lock;
  const actions: RankedAction[] = [];

  if (gapOpen(ledger, "TRANSCRIPT_ON_FILE") || gapOpen(ledger, "ACCOUNT_BALANCE")) {
    actions.push(
      scored({
        action_id: "UPLOAD_ACCOUNT_TRANSCRIPT",
        title: "Upload your IRS Account Transcript",
        why: "Confirms the balance the IRS is using before you choose a relief path",
        what_changes: "Promotes ACCOUNT_BALANCE to VERIFIED and closes the transcript gap",
        actor: "customer",
        blocks_goal_progress: true,
        scores: {
          legal_case_materiality: 3,
          evidence_gap_importance: 3,
          deadline_urgency: input.hasNoticeDeadline ? 2 : 1,
          goal_relevance: 3,
          ability_to_resolve: 3,
        },
        effects: [
          { op: "RESOLVE_UNKNOWN", fact_id: "TRANSCRIPT_ON_FILE" },
          { op: "PROMOTE_FACT", fact_id: "ACCOUNT_BALANCE", from: "REPORTED", to: "VERIFIED" },
        ],
      }),
    );
  }

  if (gapOpen(ledger, "TAX_YEAR")) {
    actions.push(
      scored({
        action_id: "CONFIRM_TAX_YEAR",
        title: "Confirm the tax year at issue",
        why: "Relief and notice response paths depend on the correct year",
        what_changes: "Resolves TAX_YEAR unknown",
        actor: "customer",
        blocks_goal_progress: true,
        scores: {
          legal_case_materiality: 2,
          evidence_gap_importance: 3,
          deadline_urgency: 1,
          goal_relevance: 3,
          ability_to_resolve: 3,
        },
        effects: [{ op: "RESOLVE_UNKNOWN", fact_id: "TAX_YEAR" }],
      }),
    );
  }

  if (isCp2000Lock(lock) || ledgerFact(ledger, "NOTICE_CODE")?.value) {
    actions.push(
      scored({
        action_id: "RESPOND_TO_NOTICE",
        title: "Prepare a response to the IRS notice",
        why: "Notice deadlines control whether proposed changes become assessed",
        what_changes: "Moves the matter from explain → respond",
        actor: "customer",
        blocks_goal_progress: true,
        scores: {
          legal_case_materiality: 3,
          evidence_gap_importance: 2,
          deadline_urgency: input.hasNoticeDeadline || isCp2000Lock(lock) ? 3 : 2,
          goal_relevance: 3,
          ability_to_resolve: 2,
        },
        effects: [],
      }),
    );
  }

  if (isCollectionsLevyLock(lock)) {
    actions.push(
      scored({
        action_id: "ADDRESS_LEVY_RISK",
        title: "Address levy / collection risk",
        why: "Collection notices can escalate quickly",
        what_changes: "Prioritizes payment, installment, or CNC over new return filing",
        actor: "customer",
        blocks_goal_progress: true,
        scores: {
          legal_case_materiality: 3,
          evidence_gap_importance: 2,
          deadline_urgency: 3,
          goal_relevance: 3,
          ability_to_resolve: 2,
        },
        effects: [],
      }),
    );
  }

  // Generics — must lose to gap resolvers (INV-ACT-01)
  actions.push(
    scored({
      action_id: "REVIEW_RETURN",
      title: "Review your tax return",
      why: "General review",
      what_changes: "No ledger change",
      actor: "customer",
      blocks_goal_progress: false,
      scores: {
        legal_case_materiality: 1,
        evidence_gap_importance: 0,
        deadline_urgency: 0,
        goal_relevance: 1,
        ability_to_resolve: 1,
      },
      effects: [],
    }),
    scored({
      action_id: "ASK_FOLLOW_UP",
      title: "Ask a follow-up question",
      why: "Generic coaching",
      what_changes: "No ledger change",
      actor: "customer",
      blocks_goal_progress: false,
      scores: {
        legal_case_materiality: 0,
        evidence_gap_importance: 0,
        deadline_urgency: 0,
        goal_relevance: 1,
        ability_to_resolve: 1,
      },
      effects: [],
    }),
    scored({
      action_id: "REGENERATE_MATTER_SUMMARY",
      title: "Refresh the matter summary",
      why: "System consequence after evidence updates",
      what_changes: "Rebuilds presentation from ledger",
      actor: "system",
      blocks_goal_progress: false,
      scores: {
        legal_case_materiality: 1,
        evidence_gap_importance: 0,
        deadline_urgency: 0,
        goal_relevance: 2,
        ability_to_resolve: 2,
      },
      effects: [],
    }),
  );

  return rankScoredActions(actions);
}

/** INV-ACT-01: first customer gap-resolver must outrank generics. */
export function assertGapResolversOutrankGenerics(actions: RankedAction[]): boolean {
  const ranked = rankScoredActions(actions);
  const firstCustomerGap = ranked.find(
    (a) => a.actor === "customer" && a.blocks_goal_progress && !GENERIC_ACTION_IDS.has(a.action_id),
  );
  const firstGeneric = ranked.find((a) => GENERIC_ACTION_IDS.has(a.action_id));
  if (!firstCustomerGap || !firstGeneric) return true;
  return ranked.indexOf(firstCustomerGap) < ranked.indexOf(firstGeneric);
}
