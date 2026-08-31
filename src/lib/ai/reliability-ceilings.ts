/**
 * V5.1 Phase F — per-stage + aggregate model-call ceilings (tax pipelines).
 * Domain-agnostic contracts ported from ImmigrationOnMe; numbers frozen in Wave 6.
 */

export const PHASE0_RELIABILITY_CEILINGS = {
  logicalAnalysesPerUserRequest: 1,
  maxModelAttemptsPerStage: 2,
  maxFallbackModelsPerStage: 1,
  maxStructuredOutputRetries: 1,
  uncaughtModelFailuresInCustomerOutput: 0,
  duplicateConcurrentLogicalAnalyses: 0,
} as const;

/**
 * Approved aggregate ceilings (Phase F).
 * Tax golden provisional hints promoted to production hard-stops.
 */
export const PHASE_F_AGGREGATE_CEILINGS = {
  maxTotalModelCallsPerAnalysis: 24,
  maxTotalFailedModelCalls: 4,
  maxRetryChildren: 3,
  coalesceChildrenPerParent: 1,
  maxWallClockSeconds: 180,
  targetSuccessRate: 0.95,
  maxTokenBudgetHint: 250_000,
  approvedAt: "2026-08-31",
  approvedSource: "wave6_tax_golden_provisional_hints_promoted",
} as const;

/** @deprecated Use PHASE_F_AGGREGATE_CEILINGS */
export const PHASE_F_AGGREGATE_HINTS = PHASE_F_AGGREGATE_CEILINGS;

export type StageBudget = {
  attempts: number;
  fallbacksUsed: number;
  structuredRetries: number;
};

export type AggregateUsage = {
  modelCallCount: number;
  failedCallCount: number;
  wallClockMs: number;
};

export type AggregateCeilingBreach =
  | "max_total_model_calls"
  | "max_total_failed_model_calls"
  | "max_wall_clock_seconds";

export function emptyStageBudget(): StageBudget {
  return { attempts: 0, fallbacksUsed: 0, structuredRetries: 0 };
}

export function canAttemptStep(budget: StageBudget, ceilings = PHASE0_RELIABILITY_CEILINGS): boolean {
  return budget.attempts < ceilings.maxModelAttemptsPerStage;
}

export function canUseFallback(budget: StageBudget, ceilings = PHASE0_RELIABILITY_CEILINGS): boolean {
  return budget.fallbacksUsed < ceilings.maxFallbackModelsPerStage;
}

export function canRetryStructuredOutput(budget: StageBudget, ceilings = PHASE0_RELIABILITY_CEILINGS): boolean {
  return budget.structuredRetries < ceilings.maxStructuredOutputRetries;
}

export function recordAttempt(budget: StageBudget): StageBudget {
  return { ...budget, attempts: budget.attempts + 1 };
}

export function recordFallback(budget: StageBudget): StageBudget {
  return { ...budget, fallbacksUsed: budget.fallbacksUsed + 1, attempts: budget.attempts + 1 };
}

export function recordStructuredRetry(budget: StageBudget): StageBudget {
  return { ...budget, structuredRetries: budget.structuredRetries + 1, attempts: budget.attempts + 1 };
}

export function maxStepsForStageInvocation(stepCount: number, ceilings = PHASE0_RELIABILITY_CEILINGS): number {
  const softCap = Math.max(ceilings.maxModelAttemptsPerStage + ceilings.maxFallbackModelsPerStage, 3);
  return Math.min(stepCount, softCap);
}

export function canMakeAggregateModelCall(
  usage: AggregateUsage,
  ceilings = PHASE_F_AGGREGATE_CEILINGS,
): boolean {
  if (usage.modelCallCount >= ceilings.maxTotalModelCallsPerAnalysis) return false;
  if (usage.failedCallCount >= ceilings.maxTotalFailedModelCalls) return false;
  if (usage.wallClockMs >= ceilings.maxWallClockSeconds * 1000) return false;
  return true;
}

export function detectAggregateCeilingBreach(
  usage: AggregateUsage,
  ceilings = PHASE_F_AGGREGATE_CEILINGS,
): AggregateCeilingBreach | null {
  if (usage.modelCallCount >= ceilings.maxTotalModelCallsPerAnalysis) return "max_total_model_calls";
  if (usage.failedCallCount >= ceilings.maxTotalFailedModelCalls) return "max_total_failed_model_calls";
  if (usage.wallClockMs >= ceilings.maxWallClockSeconds * 1000) return "max_wall_clock_seconds";
  return null;
}

export function canSpawnCoalesceChild(
  existingChildCount: number,
  ceilings = PHASE_F_AGGREGATE_CEILINGS,
): boolean {
  return existingChildCount < ceilings.coalesceChildrenPerParent;
}

export function canSpawnRetryChild(
  lineageChildCount: number,
  ceilings = PHASE_F_AGGREGATE_CEILINGS,
): boolean {
  return lineageChildCount < ceilings.maxRetryChildren;
}
