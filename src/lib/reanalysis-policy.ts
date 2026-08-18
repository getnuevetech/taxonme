import { STAGE_KEYS } from "./constants";

const ALL_PIPELINES = [
  STAGE_KEYS.SUMMARY,
  STAGE_KEYS.GOAL,
  STAGE_KEYS.DOCUMENT,
  STAGE_KEYS.SITUATION,
  STAGE_KEYS.PRESENTER,
] as const;

const ALLOWED_PIPELINES = new Set<string>(ALL_PIPELINES);

const MATERIAL_EVENT_DEFAULTS: Record<string, string[]> = {
  initial_case_created: [...ALL_PIPELINES],
  manual_reanalysis_requested: [...ALL_PIPELINES],
  user_summary_changed: [STAGE_KEYS.SUMMARY, STAGE_KEYS.GOAL, STAGE_KEYS.SITUATION, STAGE_KEYS.PRESENTER],
  user_goal_changed: [STAGE_KEYS.GOAL, STAGE_KEYS.SITUATION, STAGE_KEYS.PRESENTER],
  document_added: [STAGE_KEYS.DOCUMENT, STAGE_KEYS.SITUATION, STAGE_KEYS.PRESENTER],
  document_replaced: [STAGE_KEYS.DOCUMENT, STAGE_KEYS.SITUATION, STAGE_KEYS.PRESENTER],
  document_verified: [STAGE_KEYS.DOCUMENT, STAGE_KEYS.SITUATION, STAGE_KEYS.PRESENTER],
  material_user_fact_added: [STAGE_KEYS.SUMMARY, STAGE_KEYS.GOAL, STAGE_KEYS.SITUATION, STAGE_KEYS.PRESENTER],
  professional_confirmed_fact: [STAGE_KEYS.SITUATION, STAGE_KEYS.PRESENTER],
  authoritative_source_update: [STAGE_KEYS.SITUATION, STAGE_KEYS.PRESENTER],
  case_status_changed: [STAGE_KEYS.SITUATION, STAGE_KEYS.PRESENTER],
};

export function normalizeReanalysisPipelines(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? value.split(/[,\s]+/)
      : [];
  const normalized = raw
    .map((item) => String(item).trim().toLowerCase())
    .filter((item) => ALLOWED_PIPELINES.has(item));
  if (normalized.length === 0) return [...ALL_PIPELINES];
  const requested = new Set(normalized);
  return ALL_PIPELINES.filter((pipeline) => requested.has(pipeline));
}

export function pipelinesForMaterialEvent(trigger: string, requested?: unknown): string[] {
  if (requested !== undefined && requested !== null && !(typeof requested === "string" && !requested.trim())) {
    return normalizeReanalysisPipelines(requested);
  }
  return normalizeReanalysisPipelines(MATERIAL_EVENT_DEFAULTS[trigger] ?? ALL_PIPELINES);
}

export function buildReanalysisIdempotencyKey(args: {
  caseId: string;
  trigger: string;
  pipelines: string[];
  materialKey?: string;
}): string {
  const pipelineKey = normalizeReanalysisPipelines(args.pipelines).join(",");
  const materialKey = (args.materialKey || "case").slice(0, 160).replace(/\s+/g, " ");
  return `${args.caseId}:${args.trigger}:${pipelineKey}:${materialKey}`;
}
