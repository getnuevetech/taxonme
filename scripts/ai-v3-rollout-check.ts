import { PrismaClient } from "@prisma/client";
import { evaluateAiV3Readiness } from "../src/lib/ai/readiness-core";

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
  const [prompts, stages, providers, knowledgeCount, openReviews, queuedEvents, runningEvents] = await Promise.all([
    db.aiPrompt.findMany({ select: { promptId: true, isActive: true } }),
    db.pipelineStage.findMany({ include: { steps: true } }),
    db.aiProvider.findMany(),
    db.knowledgeSource.count({ where: { isActive: true } }),
    db.humanReviewItem.count({ where: { status: { in: ["open", "assigned"] } } }),
    db.caseReanalysisEvent.count({ where: { status: "queued" } }),
    db.caseReanalysisEvent.count({ where: { status: "running" } }),
  ]);
  const readiness = evaluateAiV3Readiness({ prompts, stages, providers, knowledgeCount, openReviewCount: openReviews, queuedEvents, runningEvents });
  console.log(JSON.stringify(readiness, null, 2));
  if (readiness.errors.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
