import "server-only";
import { db } from "../db";
import { callProvider, extractJson, type MediaAttachment } from "./adapters";
import { retrieveKnowledge } from "./orchestrator";
import { GLOBAL_PROMPT_ID, V3_PROMPT_RECORDS, overlayPromptIdForStage, schemaPromptIdForStage } from "./v3-prompts";
import { STAGE_KEYS } from "../constants";

// The AI Test Lab: a standalone admin tool that runs the same input across
// several models at once, per platform function, so the admin can compare
// outputs side by side and decide which model to assign to which pipeline
// role. It never touches customer or consultant data.

export type LabFunction = {
  key: string;
  name: string;
  promptId: string | "custom";
  stageKey: string;
  usesKnowledge: boolean;
  description: string;
};

export const LAB_FUNCTIONS: LabFunction[] = [
  { key: "fact_extraction", name: "Summary - fact extraction", promptId: "RESP-FACT-v3", stageKey: STAGE_KEYS.SUMMARY, usesKnowledge: false, description: "Pull structured facts out of a taxpayer's story." },
  { key: "interpretation", name: "Summary - case interpretation", promptId: "RESP-INT-v3", stageKey: STAGE_KEYS.SUMMARY, usesKnowledge: false, description: "Identify apparent issues, contradictions, and missing evidence." },
  { key: "skeptic", name: "Summary - skeptic review", promptId: "RESP-SKEP-v3", stageKey: STAGE_KEYS.SUMMARY, usesKnowledge: false, description: "Find assumptions and unsupported conclusions in the input." },
  { key: "document_extraction", name: "Document analysis - extraction", promptId: "RESP-DOC-A-v3", stageKey: STAGE_KEYS.DOCUMENT, usesKnowledge: false, description: "Extract uploaded documents into the standardized schema." },
  { key: "situation_analysis", name: "Situation analysis (IRS-grounded)", promptId: "RESP-ANL-v3", stageKey: STAGE_KEYS.SITUATION, usesKnowledge: true, description: "Structured issue analysis grounded in the IRS knowledge base." },
  { key: "presentation", name: "Customer presentation", promptId: "RESP-PRES-v3", stageKey: STAGE_KEYS.PRESENTER, usesKnowledge: false, description: "Convert approved analysis into structured UI JSON." },
  { key: "notice_explanation", name: "Notice explanation", promptId: "RESP-NOT-ANL-v3", stageKey: STAGE_KEYS.NOTICE, usesKnowledge: true, description: "Explain an IRS notice with notice-specific grounding." },
  { key: "letter_draft", name: "Response letter drafting", promptId: "RESP-LTR-DRAFT-v3", stageKey: STAGE_KEYS.LETTER, usesKnowledge: false, description: "Draft a professional response letter to the IRS." },
  { key: "qa_chat", name: "Tax Q&A assistant", promptId: "RESP-AST-v3", stageKey: STAGE_KEYS.QA, usesKnowledge: true, description: "Conversational plain-English tax help, grounded in the knowledge base." },
  { key: "closing", name: "Closing remarks", promptId: "RESP-CLOSE-SUM-v3", stageKey: STAGE_KEYS.CLOSING, usesKnowledge: false, description: "Write a case closure record and customer summary." },
  { key: "custom", name: "Custom prompt", promptId: "custom", stageKey: "custom", usesKnowledge: false, description: "Write your own prompt. Use {{input}} where the message should be inserted." },
];

export type LabResult = {
  providerId: string;
  providerName: string;
  model: string;
  ok: boolean;
  text: string;
  parsed: Record<string, unknown> | null;
  latencyMs: number;
  error: string;
  visionUsed: boolean;
};

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

export async function runLabTest(args: {
  providerIds: string[];
  functionKey: string;
  customPrompt: string;
  message: string;
  histories: Record<string, { role: string; content: string }[]>;
  media: MediaAttachment[];
  docText: string;
}): Promise<LabResult[]> {
  const fn = LAB_FUNCTIONS.find((f) => f.key === args.functionKey) ?? LAB_FUNCTIONS[0];
  const providers = await db.aiProvider.findMany({ where: { id: { in: args.providerIds } } });

  const knowledge = fn.usesKnowledge ? await retrieveKnowledge(args.message).catch(() => "") : "";
  const promptRecord = V3_PROMPT_RECORDS.find((p) => p.promptId === fn.promptId);
  const global = V3_PROMPT_RECORDS.find((p) => p.promptId === GLOBAL_PROMPT_ID);
  const overlay = V3_PROMPT_RECORDS.find((p) => p.promptId === overlayPromptIdForStage(fn.stageKey));
  const schema = V3_PROMPT_RECORDS.find((p) => p.promptId === schemaPromptIdForStage(fn.stageKey));
  const template =
    fn.promptId === "custom"
      ? args.customPrompt || "{{input}}"
      : [global?.body, promptRecord?.body, overlay?.body, schema?.body].filter(Boolean).join("\n\n---\n\n");

  const results = await Promise.all(
    providers.map(async (p): Promise<LabResult> => {
      const base: Omit<LabResult, "ok" | "text" | "parsed" | "latencyMs" | "error"> = {
        providerId: p.id,
        providerName: p.name,
        model: p.model,
        visionUsed: p.supportsVision && args.media.length > 0,
      };
      if (!p.apiKey) {
        return { ...base, ok: false, text: "", parsed: null, latencyMs: 0, error: "No API key saved for this provider." };
      }
      try {
        // Each column keeps its own conversation: prior turns for THIS model
        // plus the new message and any extracted document text.
        const history = args.histories[p.id] ?? [];
        const convo = [
          ...history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`),
          `User: ${args.message}`,
        ].join("\n");
        const input = [convo, args.docText ? `\n\nATTACHED DOCUMENT CONTENT:\n${args.docText}` : ""].join("");
        const vars: Record<string, string> = {
          input,
          prior: "(none)",
          facts: input,
          documents: args.docText || "(no documents attached)",
          knowledge: knowledge || "(no matching reference material)",
          goal: "(not specified — admin test)",
          context: "(admin test lab — no account snapshot)",
          case: input,
          case_context: input,
          current_step: "(admin test)",
          allowed_actions: "(admin test)",
          verified_documents: args.docText || "(none)",
          document_id: "admin-test",
          document_findings: args.docText || "(no documents attached)",
          existing_verified_documents: "(none)",
          summary_analysis: input,
          verified_case_facts: input,
          goal_extraction: input,
          normalized_goals: input,
          verified_facts: input,
          irs_sources: knowledge || "(no matching reference material)",
          system_calculations: "(none)",
          notice_document: input,
          notice: input,
          claims: input,
          verified_answer: input,
          question: args.message,
          tax_year_or_context: "unknown unless stated",
          position: input,
          supporting_documents: args.docText || "(none)",
          selected_candidate: "(n/a)",
          match_factors_used: "(n/a)",
          case_requirements: input,
          eligible_candidates: "(n/a)",
          base_scores: "(n/a)",
          approved_profile_fields: "(n/a)",
          full_case_history: input,
          final_issue_states: "(admin test)",
          completed_actions: "(none)",
          professional_updates: "(none)",
          future_obligations: "(none)",
          draft: input,
          required_changes: "(none)",
          candidates: "(n/a)",
          consultant: "(n/a)",
        };
        const prompt = fill(template, vars);
        const result = await callProvider(p, [{ role: "user", content: prompt }], args.media);
        const parsed = extractJson(result.text);
        return {
          ...base,
          ok: true,
          text: result.text,
          parsed,
          latencyMs: result.latencyMs,
          error: "",
        };
      } catch (err) {
        return {
          ...base,
          ok: false,
          text: "",
          parsed: null,
          latencyMs: 0,
          error: String(err instanceof Error ? err.message : err).slice(0, 800),
        };
      }
    }),
  );
  return results;
}
