import "server-only";
import { db } from "../db";
import { evaluateAiV3Readiness, type AiV3Readiness } from "./readiness-core";

export async function checkAiV3Readiness(): Promise<AiV3Readiness> {
  const [prompts, stages, providers, knowledgeCount, openReviewCount, queuedEvents, runningEvents] = await Promise.all([
    db.aiPrompt.findMany({ select: { promptId: true, isActive: true } }),
    db.pipelineStage.findMany({ include: { steps: true } }),
    db.aiProvider.findMany(),
    db.knowledgeSource.count({ where: { isActive: true } }),
    db.humanReviewItem.count({ where: { status: { in: ["open", "assigned"] } } }),
    db.caseReanalysisEvent.count({ where: { status: "queued" } }),
    db.caseReanalysisEvent.count({ where: { status: "running" } }),
  ]);

  return evaluateAiV3Readiness({ prompts, stages, providers, knowledgeCount, openReviewCount, queuedEvents, runningEvents });
}
