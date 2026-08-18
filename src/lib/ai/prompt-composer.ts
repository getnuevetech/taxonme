import "server-only";
import { db } from "../db";
import { redactPromptVars } from "./privacy";
import { AI_V3_VERSION, DOMAIN_RULES_PROMPT_ID, GLOBAL_PROMPT_ID, overlayPromptIdForStage, schemaPromptIdForStage } from "./v3-prompts";

export type PromptStepLike = {
  stageKey: string;
  role: string;
  promptTemplate: string;
  promptId?: string;
  promptVersion?: string;
  schemaVersion?: string;
  pipelineVersion?: string;
};

export type ComposedPrompt = {
  text: string;
  promptId: string;
  promptVersion: string;
  schemaVersion: string;
  pipelineVersion: string;
  usedRegistry: boolean;
};

export type BuildPromptInput = {
  domain?: string;
  pipeline: string;
  responsibility: string;
  caseVersion?: number | string;
  caseSnapshot?: string;
  evidenceIds?: string[];
  sourceIds?: string[];
  outputSchema?: string;
  promptVersion?: string;
  taskInstructions?: string;
  vars?: Record<string, string>;
  legacyTemplate?: string;
  promptId?: string;
};

export function fillPrompt(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function byPromptId<T extends { promptId: string }>(records: T[], promptId: string): T | undefined {
  return records.find((r) => r.promptId === promptId);
}

export async function composePromptForStep(
  step: PromptStepLike,
  vars: Record<string, string>,
): Promise<ComposedPrompt> {
  return buildPrompt({
    pipeline: step.stageKey,
    responsibility: step.role,
    promptId: step.promptId || "",
    promptVersion: step.promptVersion || AI_V3_VERSION,
    caseVersion: vars.case_version,
    caseSnapshot: vars.current_canonical_case_state,
    evidenceIds: (vars.evidence_ids ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    sourceIds: (vars.source_ids ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    outputSchema: schemaPromptIdForStage(step.stageKey),
    vars,
    legacyTemplate: step.promptTemplate,
  });
}

export async function buildPrompt(input: BuildPromptInput): Promise<ComposedPrompt> {
  const vars = input.vars ?? {};
  const safeVars = redactPromptVars(vars);
  const promptId = input.promptId || "";
  const promptVersion = input.promptVersion || AI_V3_VERSION;
  const schemaVersion = AI_V3_VERSION;
  const pipelineVersion = AI_V3_VERSION;
  const overlayPromptId = overlayPromptIdForStage(input.pipeline);
  const schemaPromptId = typeof input.outputSchema === "string" && input.outputSchema.startsWith("SCHEMA-")
    ? input.outputSchema
    : schemaPromptIdForStage(input.pipeline);

  const records = await db.aiPrompt.findMany({
    where: {
      isActive: true,
      promptId: {
        in: [GLOBAL_PROMPT_ID, DOMAIN_RULES_PROMPT_ID, promptId, overlayPromptId, schemaPromptId].filter(Boolean),
      },
    },
  });
  const global = byPromptId(records, GLOBAL_PROMPT_ID);
  const domain = byPromptId(records, DOMAIN_RULES_PROMPT_ID);
  const responsibility = promptId ? byPromptId(records, promptId) : undefined;
  const overlay = overlayPromptId ? byPromptId(records, overlayPromptId) : undefined;
  const schema = schemaPromptId ? byPromptId(records, schemaPromptId) : undefined;

  if (!global || !responsibility) {
    return {
      text: fillPrompt(input.legacyTemplate ?? "{{input}}", safeVars),
      promptId,
      promptVersion,
      schemaVersion,
      pipelineVersion,
      usedRegistry: false,
    };
  }

  const metadata = [
    `PROMPT_ID: ${responsibility.promptId}`,
    `PROMPT_VERSION: ${responsibility.version || promptVersion}`,
    `PIPELINE_VERSION: ${pipelineVersion}`,
    `SCHEMA_VERSION: ${schema?.schemaVersion || schemaVersion}`,
    `DOMAIN: ${input.domain ?? "tax"}`,
    `RESPONSIBILITY: ${input.responsibility}`,
    `PIPELINE: ${input.pipeline}`,
    `CASE_VERSION: ${input.caseVersion ?? "unknown"}`,
    `EVIDENCE_IDS: ${(input.evidenceIds ?? []).join(",") || "none"}`,
    `SOURCE_IDS: ${(input.sourceIds ?? []).join(",") || "none"}`,
  ].join("\n");

  const text = [
    global.body,
    domain ? `DOMAIN RULES:\n${domain.body}` : "",
    `RESPONSIBILITY PROMPT:\n${responsibility.body}`,
    overlay ? `PIPELINE OVERLAY:\n${overlay.body}` : "",
    input.caseSnapshot ? `CURRENT CANONICAL CASE STATE:\n${input.caseSnapshot}` : "",
    input.taskInstructions ? `TASK-SPECIFIC INSTRUCTIONS:\n${input.taskInstructions}` : "",
    schema ? `OUTPUT CONTRACT:\n${schema.body}` : "",
    `RUN METADATA:\n${metadata}`,
    `TASK INPUTS:\n${Object.entries(safeVars)
      .map(([key, value]) => `${key.toUpperCase()}:\n${value || "(none)"}`)
      .join("\n\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return {
    text: fillPrompt(text, safeVars),
    promptId: responsibility.promptId,
    promptVersion: responsibility.version || promptVersion,
    schemaVersion: schema?.schemaVersion || schemaVersion,
    pipelineVersion,
    usedRegistry: true,
  };
}
