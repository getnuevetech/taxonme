import "server-only";
import { db } from "../db";
import { checkAiV3Readiness } from "./readiness";
import { AI_DIAGNOSTIC_COUNTERS, type AiDiagnosticCounter } from "./diagnostics-labels";

type CounterMap = Record<AiDiagnosticCounter, number>;

function emptyCounters(): CounterMap {
  return Object.fromEntries(AI_DIAGNOSTIC_COUNTERS.map((key) => [key, 0])) as CounterMap;
}

export async function getAiDiagnosticsSummary(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const [
    readiness,
    caseAnalysisCycles,
    pipelineRuns,
    modelCalls,
    failedModelCalls,
    retryLogs,
    fallbackCalls,
    cacheHits,
    queuedReanalysisEvents,
    runningReanalysisEvents,
    tokenCost,
    runsByStage,
    callsByStatus,
    recentReanalysisEvents,
    recentFailures,
  ] = await Promise.all([
    checkAiV3Readiness(),
    db.caseAnalysisVersion.count({ where: { createdAt: { gte: since } } }),
    db.analysisRun.count({ where: { startedAt: { gte: since } } }),
    db.analysisStepResult.count({ where: { run: { startedAt: { gte: since } } } }),
    db.analysisStepResult.count({ where: { status: "failed", run: { startedAt: { gte: since } } } }),
    db.systemLog.count({ where: { source: "ai_call", message: { contains: "retrying" }, createdAt: { gte: since } } }),
    db.analysisStepResult.count({ where: { providerRoute: "fallback", run: { startedAt: { gte: since } } } }),
    db.analysisRun.count({ where: { metadataJson: { contains: "\"cached\":true" }, startedAt: { gte: since } } }),
    db.caseReanalysisEvent.count({ where: { status: "queued" } }),
    db.caseReanalysisEvent.count({ where: { status: "running" } }),
    db.analysisStepResult.aggregate({
      where: { run: { startedAt: { gte: since } } },
      _sum: { inputTokens: true, outputTokens: true, estimatedCostMicros: true },
    }),
    db.analysisRun.groupBy({
      by: ["stageKey"],
      where: { startedAt: { gte: since } },
      _count: { _all: true },
    }),
    db.analysisStepResult.groupBy({
      by: ["status"],
      where: { run: { startedAt: { gte: since } } },
      _count: { _all: true },
    }),
    db.caseReanalysisEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { case: { select: { id: true, number: true, title: true } } },
    }),
    db.analysisStepResult.findMany({
      where: { status: "failed" },
      orderBy: { run: { startedAt: "desc" } },
      take: 10,
      include: {
        provider: { select: { name: true } },
        run: { include: { case: { select: { id: true, number: true, title: true } } } },
      },
    }),
  ]);

  const counters = {
    ...emptyCounters(),
    caseAnalysisCycles,
    pipelineRuns,
    modelCalls,
    failedModelCalls,
    retryLogs,
    fallbackCalls,
    cacheHits,
    queuedReanalysisEvents,
    runningReanalysisEvents,
  };

  return {
    hours,
    readiness,
    counters,
    totals: {
      inputTokens: tokenCost._sum.inputTokens ?? 0,
      outputTokens: tokenCost._sum.outputTokens ?? 0,
      estimatedCostMicros: tokenCost._sum.estimatedCostMicros ?? 0,
    },
    runsByStage: runsByStage.map((row) => ({ stageKey: row.stageKey, count: row._count._all })),
    callsByStatus: callsByStatus.map((row) => ({ status: row.status, count: row._count._all })),
    recentReanalysisEvents,
    recentFailures,
  };
}
