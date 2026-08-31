/**
 * Phase D — action ranking (tax).
 * Run: npx tsx scripts/phase-d-action-ranking-check.ts
 */
import assert from "node:assert/strict";
import {
  ACTION_PRIORITY_WEIGHTS,
  assertGapResolversOutrankGenerics,
  buildRankedTaxActions,
  computePriorityScore,
  GENERIC_ACTION_IDS,
} from "../src/lib/action-priority";
import { buildFactLedger } from "../src/lib/evidence/fact-ledger";
import { lockFromFixture, LEVY_FIXTURE } from "../src/lib/v51-fixture-pack";

assert.equal(ACTION_PRIORITY_WEIGHTS.legal_case_materiality, 3);
assert.equal(
  computePriorityScore({
    legal_case_materiality: 3,
    evidence_gap_importance: 3,
    deadline_urgency: 2,
    goal_relevance: 3,
    ability_to_resolve: 2,
  }),
  3 * 3 + 3 * 3 + 2 * 2 + 3 * 3 + 2 * 2,
);

{
  const ledger = buildFactLedger({
    situation: "I think I owe about $4,000 for 2022 but have no transcript.",
    goal: "Confirm balance",
  });
  const actions = buildRankedTaxActions({ ledger, hasNoticeDeadline: true });
  assert.ok(actions[0].action_id === "UPLOAD_ACCOUNT_TRANSCRIPT" || actions[0].blocks_goal_progress);
  assert.ok(assertGapResolversOutrankGenerics(actions));
  const generics = actions.filter((a) => GENERIC_ACTION_IDS.has(a.action_id));
  assert.ok(generics.length >= 1);
  assert.ok(actions.some((a) => a.actor === "system"));
}

{
  const actions = buildRankedTaxActions({
    lock: lockFromFixture(LEVY_FIXTURE),
    ledger: buildFactLedger({ situation: LEVY_FIXTURE.situation, goal: LEVY_FIXTURE.goal }),
    hasNoticeDeadline: true,
  });
  assert.ok(actions.some((a) => a.action_id === "ADDRESS_LEVY_RISK"));
  assert.ok(assertGapResolversOutrankGenerics(actions));
}

console.log("phase-d-action-ranking-check: ok");
