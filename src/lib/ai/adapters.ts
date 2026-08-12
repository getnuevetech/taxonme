import "server-only";
import type { AiProvider } from "@prisma/client";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ProviderResult = { text: string; latencyMs: number };

// All provider details (base URL, key, model, limits) come from the AiProvider
// row configured in the admin backend. Nothing here is hardcoded to one vendor.

// Hung upstream calls must become visible failures (logged + surfaced in the
// admin tester), never silently stuck requests.
const CALL_TIMEOUT_MS = 90_000;

async function callOpenAiCompatible(p: AiProvider, messages: ChatMessage[]): Promise<string> {
  const base = (p.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const post = (payload: Record<string, unknown>) =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

  const payload: Record<string, unknown> = {
    model: p.model,
    messages,
    max_tokens: p.maxTokens,
    temperature: p.temperature,
  };
  let res = await post(payload);
  // Newer models reject legacy parameters — adapt instead of failing:
  // max_tokens → max_completion_tokens, and drop unsupported temperature.
  if (res.status === 400) {
    const errText = await res.text();
    let changed = false;
    if (/max_tokens/i.test(errText) && !("max_completion_tokens" in payload)) {
      payload.max_completion_tokens = payload.max_tokens;
      delete payload.max_tokens;
      changed = true;
    }
    if (/temperature/i.test(errText) && "temperature" in payload) {
      delete payload.temperature;
      changed = true;
    }
    if (!changed) throw new Error(`${p.name}: HTTP 400 ${errText.slice(0, 300)}`);
    res = await post(payload);
  }
  if (!res.ok) throw new Error(`${p.name}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(p: AiProvider, messages: ChatMessage[]): Promise<string> {
  const base = (p.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const rest = messages.filter((m) => m.role !== "system");
  const post = (payload: Record<string, unknown>) =>
    fetch(`${base}/v1/messages`, {
      method: "POST",
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": p.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

  const payload: Record<string, unknown> = {
    model: p.model,
    max_tokens: p.maxTokens,
    temperature: p.temperature,
    system: system || undefined,
    messages: rest.map((m) => ({ role: m.role, content: m.content })),
  };
  let res = await post(payload);
  // Newer Claude models reject `temperature` — retry without it.
  if (res.status === 400) {
    const errText = await res.text();
    if (/temperature/i.test(errText) && "temperature" in payload) {
      delete payload.temperature;
      res = await post(payload);
    } else {
      throw new Error(`${p.name}: HTTP 400 ${errText.slice(0, 300)}`);
    }
  }
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
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
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

// Lists the model IDs the provider's endpoint actually offers — used by the
// admin connectivity tester to suggest valid model names when a test fails.
export async function listModels(p: AiProvider): Promise<string[]> {
  const signal = AbortSignal.timeout(30_000);
  if (p.kind === "anthropic") {
    const base = (p.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
    const res = await fetch(`${base}/v1/models?limit=100`, {
      signal,
      headers: { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return ((data.data ?? []) as { id?: string }[]).map((m) => String(m.id ?? "")).filter(Boolean);
  }
  if (p.kind === "google") {
    const base = (p.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
    const res = await fetch(`${base}/models?key=${p.apiKey}&pageSize=200`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return ((data.models ?? []) as { name?: string; supportedGenerationMethods?: string[] }[])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => String(m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
  }
  const base = (p.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/models`, {
    signal,
    headers: { Authorization: `Bearer ${p.apiKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return ((data.data ?? []) as { id?: string }[]).map((m) => String(m.id ?? "")).filter(Boolean);
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
