export const AI_DIAGNOSTIC_COUNTERS = [
  "caseAnalysisCycles",
  "pipelineRuns",
  "modelCalls",
  "failedModelCalls",
  "retryLogs",
  "fallbackCalls",
  "cacheHits",
  "queuedReanalysisEvents",
  "runningReanalysisEvents",
] as const;

export type AiDiagnosticCounter = (typeof AI_DIAGNOSTIC_COUNTERS)[number];
