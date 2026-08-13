import "server-only";
import { db } from "../db";
import { callProvider, extractJson, type MediaAttachment } from "./adapters";
import { DEFAULT_PROMPTS } from "./prompts";
import { retrieveKnowledge } from "./orchestrator";

// The AI Test Lab: a standalone admin tool that runs the same input across
// several models at once, per platform function, so the admin can compare
// outputs side by side and decide which model to assign to which pipeline
// role. It never touches customer or consultant data.

export type LabFunction = {
  key: string;
  name: string;
  promptKey: keyof typeof DEFAULT_PROMPTS | "custom";
  usesKnowledge: boolean;
  description: string;
};

export const LAB_FUNCTIONS: LabFunction[] = [
  { key: "fact_extraction", name: "Summary — fact extraction", promptKey: "fact_extractor", usesKnowledge: false, description: "Pull structured facts (years, amounts, notices, goal) out of a taxpayer's story." },
  { key: "interpretation", name: "Summary — case interpretation", promptKey: "interpreter", usesKnowledge: false, description: "Identify apparent issues, contradictions, and missing evidence." },
  { key: "skeptic", name: "Summary — skeptic review", promptKey: "skeptic", usesKnowledge: false, description: "Find assumptions and unsupported conclusions in the input." },
  { key: "document_extraction", name: "Document analysis — extraction", promptKey: "extractor_a", usesKnowledge: false, description: "Extract uploaded documents (attach files!) into the standardized schema." },
  { key: "situation_analysis", name: "Situation analysis (IRS-grounded)", promptKey: "analyst", usesKnowledge: true, description: "Structured issue analysis grounded in the IRS knowledge base." },
  { key: "presentation", name: "Customer presentation", promptKey: "presenter", usesKnowledge: false, description: "Convert analysis into the structured JSON the customer UI renders." },
  { key: "notice_explanation", name: "Notice explanation", promptKey: "notice_explainer", usesKnowledge: false, description: "Explain an IRS notice (paste or attach it) in plain English." },
  { key: "letter_draft", name: "Response letter drafting", promptKey: "letter_writer", usesKnowledge: false, description: "Draft a professional response letter to the IRS." },
  { key: "qa_chat", name: "Tax Q&A assistant", promptKey: "assistant", usesKnowledge: true, description: "Conversational plain-English tax help, grounded in the knowledge base." },
  { key: "closing", name: "Closing remarks", promptKey: "closing", usesKnowledge: false, description: "Write a case's final review and closing remarks." },
  { key: "custom", name: "Custom prompt", promptKey: "custom", usesKnowledge: false, description: "Write your own prompt. Use {{input}} where the message should be inserted." },
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
  const template =
    fn.promptKey === "custom"
      ? args.customPrompt || "{{input}}"
      : DEFAULT_PROMPTS[fn.promptKey];

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
