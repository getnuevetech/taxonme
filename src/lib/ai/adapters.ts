import "server-only";
import type { AiProvider } from "@prisma/client";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ProviderResult = { text: string; latencyMs: number };

// All provider details (base URL, key, model, limits) come from the AiProvider
// row configured in the admin backend. Nothing here is hardcoded to one vendor.

async function callOpenAiCompatible(p: AiProvider, messages: ChatMessage[]): Promise<string> {
  const base = (p.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify({
      model: p.model,
      messages,
      max_tokens: p.maxTokens,
      temperature: p.temperature,
    }),
  });
  if (!res.ok) throw new Error(`${p.name}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(p: AiProvider, messages: ChatMessage[]): Promise<string> {
  const base = (p.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const rest = messages.filter((m) => m.role !== "system");
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": p.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: p.maxTokens,
      temperature: p.temperature,
      system: system || undefined,
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error(`${p.name}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
}

async function callGoogle(p: AiProvider, messages: ChatMessage[]): Promise<string> {
  const base = (p.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const res = await fetch(`${base}/models/${p.model}:generateContent?key=${p.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: { maxOutputTokens: p.maxTokens, temperature: p.temperature },
    }),
  });
  if (!res.ok) throw new Error(`${p.name}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? "").join("");
}

export async function callProvider(p: AiProvider, messages: ChatMessage[]): Promise<ProviderResult> {
  const started = Date.now();
  let text: string;
  switch (p.kind) {
    case "anthropic":
      text = await callAnthropic(p, messages);
      break;
    case "google":
      text = await callGoogle(p, messages);
      break;
    default:
      text = await callOpenAiCompatible(p, messages);
  }
  return { text, latencyMs: Date.now() - started };
}

// Models are asked to return JSON; this tolerantly extracts the first JSON object.
export function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
