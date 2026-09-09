/**
 * Package U — embedding helpers for gated hybrid authority retrieval.
 * Fail closed: missing provider / bad vectors → no embedding contribution.
 */
import "server-only";
import type { AiProvider } from "@prisma/client";
import { db } from "@/lib/db";
import { validatePublicHttpsUrl } from "@/lib/url-security";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
/** Weight cosine into hybrid score (keyword terms remain primary signal). */
export const EMBED_SCORE_WEIGHT = 8;
/** Minimum cosine to contribute; below this, keyword-only. */
export const EMBED_MIN_COSINE = 0.55;

export function parseEmbeddingJson(raw: string | null | undefined): number[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 8) return null;
    const nums = parsed.map((n) => Number(n));
    if (nums.some((n) => !Number.isFinite(n))) return null;
    return nums;
  } catch {
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number | null {
  if (!a.length || a.length !== b.length) return null;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na <= 0 || nb <= 0) return null;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Hybrid score: keyword + weighted cosine when both embeddings exist and cosine clears floor. */
export function hybridAuthorityScore(
  keywordScore: number,
  queryEmbedding: number[] | null,
  sourceEmbedding: number[] | null,
): number {
  const keyword = Math.max(0, keywordScore);
  if (!queryEmbedding || !sourceEmbedding) return keyword;
  const cos = cosineSimilarity(queryEmbedding, sourceEmbedding);
  if (cos == null || cos < EMBED_MIN_COSINE) return keyword;
  return keyword + EMBED_SCORE_WEIGHT * cos;
}

export async function resolveEmbeddingProvider(): Promise<{
  provider: AiProvider;
  model: string;
} | null> {
  const provider = await db.aiProvider.findFirst({
    where: {
      isEnabled: true,
      kind: "openai_compatible",
      NOT: { apiKey: "" },
    },
    orderBy: { createdAt: "asc" },
  });
  if (!provider?.apiKey) return null;
  const model =
    process.env.EMBEDDING_MODEL?.trim() ||
    DEFAULT_EMBEDDING_MODEL;
  return { provider, model };
}

export async function embedTextOpenAiCompatible(
  provider: AiProvider,
  model: string,
  text: string,
): Promise<number[]> {
  const input = String(text || "").trim().slice(0, 8000);
  if (!input) throw new Error("Empty text for embedding.");
  const base = (provider.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
  const urlError = await validatePublicHttpsUrl(base);
  if (urlError) throw new Error(`Unsafe embedding base URL (${urlError})`);
  const res = await fetch(`${base}/embeddings`, {
    method: "POST",
    signal: AbortSignal.timeout(Math.max(5_000, Math.min(180_000, provider.timeoutMs || 90_000))),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    throw new Error(`Embedding HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || !embedding.length) {
    throw new Error("Embedding response missing vector.");
  }
  return embedding.map((n) => Number(n));
}

/** Best-effort embed for one KnowledgeSource. Returns false on any failure (fail closed). */
export async function embedKnowledgeSourceById(id: string): Promise<boolean> {
  try {
    const resolved = await resolveEmbeddingProvider();
    if (!resolved) return false;
    const row = await db.knowledgeSource.findUnique({ where: { id } });
    if (!row || !row.isActive) return false;
    const text = [row.title, row.reference, row.tags, row.content].filter(Boolean).join("\n");
    const vector = await embedTextOpenAiCompatible(resolved.provider, resolved.model, text);
    await db.knowledgeSource.update({
      where: { id },
      data: {
        embeddingJson: JSON.stringify(vector),
        embeddingModel: resolved.model,
        embeddedAt: new Date(),
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function embedQueryText(text: string): Promise<{
  embedding: number[];
  model: string;
} | null> {
  try {
    const resolved = await resolveEmbeddingProvider();
    if (!resolved) return null;
    const embedding = await embedTextOpenAiCompatible(
      resolved.provider,
      resolved.model,
      text,
    );
    return { embedding, model: resolved.model };
  } catch {
    return null;
  }
}
