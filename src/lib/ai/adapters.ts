import "server-only";
import type { AiProvider } from "@prisma/client";
import { validatePublicHttpsUrl } from "../url-security";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ProviderResult = { text: string; latencyMs: number };
// Documents/images sent alongside the prompt to vision-capable providers.
export type MediaAttachment = { mimeType: string; dataBase64: string; name: string };

// All provider details (base URL, key, model, limits) come from the AiProvider
// row configured in the admin backend. Nothing here is hardcoded to one vendor.

// Hung upstream calls must become visible failures (logged + surfaced in the
// admin tester), never silently stuck requests.
const CALL_TIMEOUT_MS = 90_000;

function timeoutForProvider(p: AiProvider): number {
  return Math.max(5_000, Math.min(180_000, p.timeoutMs || CALL_TIMEOUT_MS));
}

async function providerBaseUrl(p: AiProvider, fallback: string): Promise<string> {
  const base = (p.baseUrl || fallback).replace(/\/$/, "");
  const urlError = await validatePublicHttpsUrl(base);
  if (urlError) throw new Error(`${p.name}: unsafe provider base URL (${urlError})`);
  return base;
}

async function callOpenAiCompatible(p: AiProvider, messages: ChatMessage[], media: MediaAttachment[] = []): Promise<string> {
  const base = await providerBaseUrl(p, "https://api.openai.com/v1");
  const post = (payload: Record<string, unknown>) =>
    fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutForProvider(p)),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${p.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

  // Attach documents/images to the last user message as multimodal content.
  const wire: unknown[] = messages.map((m) => ({ role: m.role, content: m.content }));
  if (media.length > 0) {
    const last = wire[wire.length - 1] as { role: string; content: unknown };
    last.content = [
      { type: "text", text: String(last.content) },
      ...media.map((att) =>
        att.mimeType.startsWith("image/")
          ? { type: "image_url", image_url: { url: `data:${att.mimeType};base64,${att.dataBase64}` } }
          : { type: "file", file: { filename: att.name, file_data: `data:${att.mimeType};base64,${att.dataBase64}` } },
      ),
    ];
  }

  const payload: Record<string, unknown> = {
    model: p.model,
    messages: wire,
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

async function callAnthropic(p: AiProvider, messages: ChatMessage[], media: MediaAttachment[] = []): Promise<string> {
  const base = await providerBaseUrl(p, "https://api.anthropic.com");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const rest = messages.filter((m) => m.role !== "system");
  const post = (payload: Record<string, unknown>) =>
    fetch(`${base}/v1/messages`, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutForProvider(p)),
      headers: {
        "Content-Type": "application/json",
        "x-api-key": p.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

  const wire: unknown[] = rest.map((m) => ({ role: m.role, content: m.content }));
  if (media.length > 0) {
    const last = wire[wire.length - 1] as { role: string; content: unknown };
    last.content = [
      ...media.map((att) =>
        att.mimeType.startsWith("image/")
          ? { type: "image", source: { type: "base64", media_type: att.mimeType, data: att.dataBase64 } }
          : { type: "document", source: { type: "base64", media_type: "application/pdf", data: att.dataBase64 } },
      ),
      { type: "text", text: String(last.content) },
    ];
  }

  const payload: Record<string, unknown> = {
    model: p.model,
    max_tokens: p.maxTokens,
    temperature: p.temperature,
    system: system || undefined,
    messages: wire,
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

async function callGoogle(p: AiProvider, messages: ChatMessage[], media: MediaAttachment[] = []): Promise<string> {
  const base = await providerBaseUrl(p, "https://generativelanguage.googleapis.com/v1beta");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] as unknown[] }));
  if (media.length > 0 && contents.length > 0) {
    contents[contents.length - 1].parts.push(
      ...media.map((att) => ({ inline_data: { mime_type: att.mimeType, data: att.dataBase64 } })),
    );
  }
  const res = await fetch(`${base}/models/${p.model}:generateContent?key=${p.apiKey}`, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutForProvider(p)),
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

export async function callProvider(
  p: AiProvider,
  messages: ChatMessage[],
  media: MediaAttachment[] = [],
): Promise<ProviderResult> {
  const started = Date.now();
  // Media only goes to providers marked vision-capable in the admin backend.
  const attachments = p.supportsVision ? media : [];
  let text: string;
  switch (p.kind) {
    case "anthropic":
      text = await callAnthropic(p, messages, attachments);
      break;
    case "google":
      text = await callGoogle(p, messages, attachments);
      break;
    default:
      text = await callOpenAiCompatible(p, messages, attachments);
  }
  return { text, latencyMs: Date.now() - started };
}

// Lists the model IDs the provider's endpoint actually offers — used by the
// admin connectivity tester to suggest valid model names when a test fails.
export async function listModels(p: AiProvider): Promise<string[]> {
  const signal = AbortSignal.timeout(30_000);
  if (p.kind === "anthropic") {
    const base = await providerBaseUrl(p, "https://api.anthropic.com");
    const res = await fetch(`${base}/v1/models?limit=100`, {
      signal,
      headers: { "x-api-key": p.apiKey, "anthropic-version": "2023-06-01" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return ((data.data ?? []) as { id?: string }[]).map((m) => String(m.id ?? "")).filter(Boolean);
  }
  if (p.kind === "google") {
    const base = await providerBaseUrl(p, "https://generativelanguage.googleapis.com/v1beta");
    const res = await fetch(`${base}/models?key=${p.apiKey}&pageSize=200`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return ((data.models ?? []) as { name?: string; supportedGenerationMethods?: string[] }[])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => String(m.name ?? "").replace(/^models\//, ""))
      .filter(Boolean);
  }
  const base = await providerBaseUrl(p, "https://api.openai.com/v1");
  const res = await fetch(`${base}/models`, {
    signal,
    headers: { Authorization: `Bearer ${p.apiKey}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return ((data.data ?? []) as { id?: string }[]).map((m) => String(m.id ?? "")).filter(Boolean);
}

// Models are asked to return JSON, but real-world output is messy: code
// fences, commentary around the object, trailing commas, smart quotes.
// This extractor tries progressively harder before giving up.

function balancedJsonSlice(s: string, open: "{" | "["): string | null {
  const close = open === "{" ? "}" : "]";
  const start = s.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function cleanupJson(s: string): string {
  return s
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}

export function extractJson(text: string): Record<string, unknown> | null {
  const candidates: string[] = [];
  for (const m of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(m[1]);
  candidates.push(text);

  const tryObject = (cand: string): Record<string, unknown> | null => {
    const slices = [
      balancedJsonSlice(cand, "{"),
      (() => {
        const start = cand.indexOf("{");
        const end = cand.lastIndexOf("}");
        return start !== -1 && end > start ? cand.slice(start, end + 1) : null;
      })(),
    ].filter((x): x is string => Boolean(x));
    for (const slice of slices) {
      for (const attempt of [slice, cleanupJson(slice)]) {
        try {
          const parsed = JSON.parse(attempt);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
        } catch { /* try the next strategy */ }
      }
    }
    return null;
  };
  // Top-level arrays are valid model output too — wrapped for object consumers.
  const tryArray = (cand: string): Record<string, unknown> | null => {
    const arr = balancedJsonSlice(cand, "[");
    if (!arr) return null;
    for (const attempt of [arr, cleanupJson(arr)]) {
      try {
        const parsed = JSON.parse(attempt);
        if (Array.isArray(parsed)) return { items: parsed };
      } catch { /* try the next strategy */ }
    }
    return null;
  };

  for (const cand of candidates) {
    const objIdx = cand.indexOf("{");
    const arrIdx = cand.indexOf("[");
    const arrayFirst = arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx);
    const result = arrayFirst ? (tryArray(cand) ?? tryObject(cand)) : (tryObject(cand) ?? tryArray(cand));
    if (result) return result;
  }
  return null;
}
