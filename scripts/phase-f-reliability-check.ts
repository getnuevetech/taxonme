/**
 * Phase F reliability ceiling unit checks (no DB).
 * Run: npx tsx scripts/phase-f-reliability-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PHASE0_RELIABILITY_CEILINGS,
  PHASE_F_AGGREGATE_CEILINGS,
  PHASE_F_AGGREGATE_HINTS,
  canAttemptStep,
  canMakeAggregateModelCall,
  canRetryStructuredOutput,
  canSpawnCoalesceChild,
  canSpawnRetryChild,
  canUseFallback,
  detectAggregateCeilingBreach,
  emptyStageBudget,
  maxStepsForStageInvocation,
  recordAttempt,
  recordFallback,
  recordStructuredRetry,
} from "../src/lib/ai/reliability-ceilings";

assert.equal(PHASE0_RELIABILITY_CEILINGS.logicalAnalysesPerUserRequest, 1);
assert.equal(PHASE0_RELIABILITY_CEILINGS.maxModelAttemptsPerStage, 2);
assert.equal(PHASE0_RELIABILITY_CEILINGS.maxFallbackModelsPerStage, 1);
assert.equal(PHASE0_RELIABILITY_CEILINGS.maxStructuredOutputRetries, 1);
assert.equal(PHASE0_RELIABILITY_CEILINGS.duplicateConcurrentLogicalAnalyses, 0);

let b = emptyStageBudget();
assert.equal(canAttemptStep(b), true);
b = recordAttempt(b);
assert.equal(b.attempts, 1);
b = recordAttempt(b);
assert.equal(canAttemptStep(b), false);
assert.equal(canRetryStructuredOutput(emptyStageBudget()), true);
assert.equal(canRetryStructuredOutput(recordStructuredRetry(emptyStageBudget())), false);

let f = emptyStageBudget();
assert.equal(canUseFallback(f), true);
f = recordFallback(f);
assert.equal(canUseFallback(f), false);

assert.equal(maxStepsForStageInvocation(10), 3);
assert.equal(maxStepsForStageInvocation(2), 2);

assert.equal(PHASE_F_AGGREGATE_CEILINGS.maxTotalModelCallsPerAnalysis, 24);
assert.equal(PHASE_F_AGGREGATE_CEILINGS.maxTotalFailedModelCalls, 4);
assert.equal(PHASE_F_AGGREGATE_CEILINGS.maxRetryChildren, 3);
assert.equal(PHASE_F_AGGREGATE_CEILINGS.coalesceChildrenPerParent, 1);
assert.equal(PHASE_F_AGGREGATE_CEILINGS.maxWallClockSeconds, 180);
assert.equal(PHASE_F_AGGREGATE_HINTS.maxTotalModelCallsPerAnalysis, 24);

assert.equal(canMakeAggregateModelCall({ modelCallCount: 23, failedCallCount: 0, wallClockMs: 0 }), true);
assert.equal(canMakeAggregateModelCall({ modelCallCount: 24, failedCallCount: 0, wallClockMs: 0 }), false);
assert.equal(
  detectAggregateCeilingBreach({ modelCallCount: 24, failedCallCount: 0, wallClockMs: 0 }),
  "max_total_model_calls",
);
assert.equal(
  detectAggregateCeilingBreach({ modelCallCount: 1, failedCallCount: 4, wallClockMs: 0 }),
  "max_total_failed_model_calls",
);
assert.equal(
  detectAggregateCeilingBreach({ modelCallCount: 1, failedCallCount: 0, wallClockMs: 180_000 }),
  "max_wall_clock_seconds",
);
assert.equal(canSpawnCoalesceChild(0), true);
assert.equal(canSpawnCoalesceChild(1), false);
assert.equal(canSpawnRetryChild(2), true);
assert.equal(canSpawnRetryChild(3), false);

{
  const orch = readFileSync(join(process.cwd(), "src/lib/ai/orchestrator.ts"), "utf8");
  assert.ok(orch.includes("reliability-ceilings") || orch.includes("canAttemptStep"));
  const spec = readFileSync(join(process.cwd(), "docs/v5.1/V5.1-CORRECTION-SPEC.md"), "utf8");
  assert.ok(/FROZEN/i.test(spec));
}

console.log("phase-f-reliability-check: ok");
