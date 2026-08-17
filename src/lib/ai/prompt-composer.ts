import "server-only";
import { db } from "../db";
import { AI_V3_VERSION, GLOBAL_PROMPT_ID, overlayPromptIdForStage, schemaPromptIdForStage } from "./v3-prompts";

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
  const promptId = step.promptId || "";
  const promptVersion = step.promptVersion || AI_V3_VERSION;
  const schemaVersion = step.schemaVersion || AI_V3_VERSION;
  const pipelineVersion = step.pipelineVersion || AI_V3_VERSION;
  const overlayPromptId = overlayPromptIdForStage(step.stageKey);
  const schemaPromptId = schemaPromptIdForStage(step.stageKey);

  const records = await db.aiPrompt.findMany({
    where: {
      isActive: true,
      promptId: {
        in: [GLOBAL_PROMPT_ID, promptId, overlayPromptId, schemaPromptId].filter(Boolean),
      },
    },
  });
  const global = byPromptId(records, GLOBAL_PROMPT_ID);
  const responsibility = promptId ? byPromptId(records, promptId) : undefined;
  const overlay = overlayPromptId ? byPromptId(records, overlayPromptId) : undefined;
  const schema = schemaPromptId ? byPromptId(records, schemaPromptId) : undefined;

  if (!global || !responsibility) {
    return {
      text: fillPrompt(step.promptTemplate, vars),
      promptId,
      promptVersion: step.promptVersion || "",
      schemaVersion: step.schemaVersion || "",
      pipelineVersion: step.pipelineVersion || "",
      usedRegistry: false,
    };
  }

  const metadata = [
    `PROMPT_ID: ${responsibility.promptId}`,
    `PROMPT_VERSION: ${responsibility.version || promptVersion}`,
    `PIPELINE_VERSION: ${pipelineVersion}`,
    `SCHEMA_VERSION: ${schema?.schemaVersion || schemaVersion}`,
    `RESPONSIBILITY: ${step.role}`,
    `PIPELINE: ${step.stageKey}`,
  ].join("\n");

  const text = [
    global.body,
    `RESPONSIBILITY PROMPT:\n${responsibility.body}`,
    overlay ? `PIPELINE OVERLAY:\n${overlay.body}` : "",
    schema ? `OUTPUT CONTRACT:\n${schema.body}` : "",
    `RUN METADATA:\n${metadata}`,
    `TASK INPUTS:\n${Object.entries(vars)
      .map(([key, value]) => `${key.toUpperCase()}:\n${value || "(none)"}`)
      .join("\n\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  return {
    text: fillPrompt(text, vars),
    promptId: responsibility.promptId,
    promptVersion: responsibility.version || promptVersion,
    schemaVersion: schema?.schemaVersion || schemaVersion,
    pipelineVersion,
    usedRegistry: true,
  };
}
