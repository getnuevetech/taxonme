import "server-only";
import { db } from "../db";
import { V3_PIPELINE_BLUEPRINT, V3_PROMPT_RECORDS } from "./v3-prompts";

export type AiV3Readiness = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  metrics: Record<string, number>;
};

export async function checkAiV3Readiness(): Promise<AiV3Readiness> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const [prompts, stages, providers, knowledgeCount, openReviewCount, queuedEvents, runningEvents] = await Promise.all([
    db.aiPrompt.findMany({ select: { promptId: true, isActive: true } }),
    db.pipelineStage.findMany({ include: { steps: true } }),
    db.aiProvider.findMany(),
    db.knowledgeSource.count({ where: { isActive: true } }),
    db.humanReviewItem.count({ where: { status: { in: ["open", "assigned"] } } }),
    db.caseReanalysisEvent.count({ where: { status: "queued" } }),
    db.caseReanalysisEvent.count({ where: { status: "running" } }),
  ]);

  const promptIds = new Set(prompts.filter((p) => p.isActive).map((p) => p.promptId));
  for (const required of V3_PROMPT_RECORDS) {
    if (!promptIds.has(required.promptId)) errors.push(`Missing active prompt ${required.promptId}`);
  }

  for (const blueprint of V3_PIPELINE_BLUEPRINT) {
    const stage = stages.find((s) => s.key === blueprint.key);
    if (!stage?.isEnabled) {
      errors.push(`Pipeline stage ${blueprint.key} is missing or disabled`);
      continue;
    }
    for (const expected of blueprint.steps.filter((s) => !s.isConditional)) {
      const match = stage.steps.find((s) => s.role === expected.role && s.promptId === expected.promptId && s.isEnabled);
      if (!match) errors.push(`Pipeline ${blueprint.key} missing enabled ${expected.role} step with ${expected.promptId}`);
    }
  }

  const approvedProviders = providers.filter((p) =>
    p.isEnabled &&
    p.apiKey &&
    p.dataRetentionProfile.startsWith("approved") &&
    p.regionProfile.startsWith("approved"),
  );
  if (approvedProviders.length === 0) warnings.push("No enabled AI provider is approved for taxpayer data with an API key.");
  if (knowledgeCount === 0) warnings.push("IRS knowledge base has no active source records.");
  if (openReviewCount > 0) warnings.push(`${openReviewCount} human-review item(s) are open or assigned.`);
  if (queuedEvents > 0) warnings.push(`${queuedEvents} queued re-analysis event(s) are waiting for cron processing.`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: {
      activePrompts: promptIds.size,
      stages: stages.length,
      providers: providers.length,
      approvedProviders: approvedProviders.length,
      activeKnowledgeSources: knowledgeCount,
      openHumanReviews: openReviewCount,
      queuedReanalysisEvents: queuedEvents,
      runningReanalysisEvents: runningEvents,
    },
  };
}
