import { PrismaClient } from "@prisma/client";
import { V3_PIPELINE_BLUEPRINT, V3_PROMPT_RECORDS } from "../src/lib/ai/v3-prompts";

const db = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log(JSON.stringify({
      ok: false,
      errors: ["DATABASE_URL is not configured; v3 rollout readiness cannot inspect database-backed prompts, pipelines, providers, sources, or queues."],
      warnings: [],
      metrics: {},
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  const [prompts, stages, providers, knowledgeCount, openReviews, queuedEvents] = await Promise.all([
    db.aiPrompt.findMany({ select: { promptId: true, isActive: true } }),
    db.pipelineStage.findMany({ include: { steps: true } }),
    db.aiProvider.findMany(),
    db.knowledgeSource.count({ where: { isActive: true } }),
    db.humanReviewItem.count({ where: { status: { in: ["open", "assigned"] } } }),
    db.caseReanalysisEvent.count({ where: { status: "queued" } }),
  ]);

  const activePrompts = new Set(prompts.filter((p) => p.isActive).map((p) => p.promptId));
  for (const prompt of V3_PROMPT_RECORDS) {
    if (!activePrompts.has(prompt.promptId)) errors.push(`Missing active prompt: ${prompt.promptId}`);
  }
  for (const blueprint of V3_PIPELINE_BLUEPRINT) {
    const stage = stages.find((s) => s.key === blueprint.key);
    if (!stage?.isEnabled) {
      errors.push(`Missing or disabled stage: ${blueprint.key}`);
      continue;
    }
    for (const expected of blueprint.steps.filter((s) => !s.isConditional)) {
      const found = stage.steps.some((s) => s.isEnabled && s.role === expected.role && s.promptId === expected.promptId);
      if (!found) errors.push(`Stage ${blueprint.key} missing ${expected.role}/${expected.promptId}`);
    }
  }
  const approvedProviders = providers.filter((p) =>
    p.isEnabled &&
    p.apiKey &&
    p.dataRetentionProfile.startsWith("approved") &&
    p.regionProfile.startsWith("approved"),
  );
  if (approvedProviders.length === 0) warnings.push("No approved enabled provider with API key.");
  if (knowledgeCount === 0) warnings.push("No active IRS knowledge sources.");
  if (openReviews > 0) warnings.push(`${openReviews} human-review item(s) open or assigned.`);
  if (queuedEvents > 0) warnings.push(`${queuedEvents} queued re-analysis event(s).`);

  console.log(JSON.stringify({
    ok: errors.length === 0,
    errors,
    warnings,
    metrics: {
      activePrompts: activePrompts.size,
      stages: stages.length,
      providers: providers.length,
      approvedProviders: approvedProviders.length,
      activeKnowledgeSources: knowledgeCount,
      openHumanReviews: openReviews,
      queuedReanalysisEvents: queuedEvents,
    },
  }, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
