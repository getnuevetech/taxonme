import { V3_PIPELINE_BLUEPRINT, V3_PROMPT_RECORDS } from "./v3-prompts";

export type AiV3Readiness = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  metrics: Record<string, number>;
};

export function evaluateAiV3Readiness(input: {
  prompts: { promptId: string; isActive: boolean }[];
  stages: { key: string; isEnabled: boolean; steps: { role: string; promptId: string; isEnabled: boolean }[] }[];
  providers: { isEnabled: boolean; apiKey: string; dataRetentionProfile: string; regionProfile: string }[];
  knowledgeCount: number;
  openReviewCount: number;
  queuedEvents: number;
  runningEvents: number;
}): AiV3Readiness {
  const errors: string[] = [];
  const warnings: string[] = [];
  const promptIds = new Set(input.prompts.filter((p) => p.isActive).map((p) => p.promptId));

  for (const required of V3_PROMPT_RECORDS) {
    if (!promptIds.has(required.promptId)) errors.push(`Missing active prompt ${required.promptId}`);
  }

  for (const blueprint of V3_PIPELINE_BLUEPRINT) {
    const stage = input.stages.find((s) => s.key === blueprint.key);
    if (!stage?.isEnabled) {
      errors.push(`Pipeline stage ${blueprint.key} is missing or disabled`);
      continue;
    }
    for (const expected of blueprint.steps.filter((s) => !s.isConditional)) {
      const match = stage.steps.find((s) => s.role === expected.role && s.promptId === expected.promptId && s.isEnabled);
      if (!match) errors.push(`Pipeline ${blueprint.key} missing enabled ${expected.role} step with ${expected.promptId}`);
    }
  }

  const approvedProviders = input.providers.filter((p) =>
    p.isEnabled &&
    p.apiKey &&
    p.dataRetentionProfile.startsWith("approved") &&
    p.regionProfile.startsWith("approved"),
  );
  if (approvedProviders.length === 0) warnings.push("No enabled AI provider is approved for taxpayer data with an API key.");
  if (input.knowledgeCount === 0) warnings.push("IRS knowledge base has no active source records.");
  if (input.openReviewCount > 0) warnings.push(`${input.openReviewCount} human-review item(s) are open or assigned.`);
  if (input.queuedEvents > 0) warnings.push(`${input.queuedEvents} queued re-analysis event(s) are waiting for cron processing.`);
  if (input.runningEvents > 0) warnings.push(`${input.runningEvents} running re-analysis event(s) are in progress.`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: {
      activePrompts: promptIds.size,
      stages: input.stages.length,
      providers: input.providers.length,
      approvedProviders: approvedProviders.length,
      activeKnowledgeSources: input.knowledgeCount,
      openHumanReviews: input.openReviewCount,
      queuedReanalysisEvents: input.queuedEvents,
      runningReanalysisEvents: input.runningEvents,
    },
  };
}
