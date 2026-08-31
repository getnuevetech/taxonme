/**
 * Phase −1.9 L7 — pattern help/harm telemetry and invalidation.
 * No live fine-tuning; stale patterns are excluded from Experience Search.
 */
import { db } from "@/lib/db";
import { isInstitutionalKey } from "./corrections";

export const TELEMETRY_VERDICTS = ["help", "harm", "served"] as const;
export type TelemetryVerdict = (typeof TELEMETRY_VERDICTS)[number];
export const HARM_AUTO_STALE_MIN = 3;
export const HARM_AUTO_STALE_RATIO = 2;

export type PatternTelemetrySnapshot = {
  id: string;
  sourceDigest: string;
  promotionLevel: number;
  helpCount: number;
  harmCount: number;
  staleAt: Date | null;
  staleReason: string;
  lastServedAt: Date | null;
};

export function shouldAutoStaleFromTelemetry(
  helpCount: number,
  harmCount: number,
): boolean {
  return (
    harmCount >= HARM_AUTO_STALE_MIN &&
    harmCount >=
      Math.max(HARM_AUTO_STALE_MIN, helpCount * HARM_AUTO_STALE_RATIO)
  );
}

export function isActivelyServable(row: {
  promotionLevel: number;
  staleAt: Date | null;
}): boolean {
  return row.promotionLevel === 4 && row.staleAt == null;
}

export function normalizeStaleReason(raw: string): string {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  if (!key || !isInstitutionalKey(key)) {
    throw new Error(
      "stale_reason must be an institutional snake_case key.",
    );
  }
  return key;
}

export async function recordPatternServed(opts: {
  sourceDigests: string[];
}): Promise<void> {
  const sourceDigests = [...new Set(opts.sourceDigests.filter(Boolean))];
  if (!sourceDigests.length) return;
  await db.experienceObservation
    .updateMany({
      where: {
        sourceDigest: { in: sourceDigests },
        promotionLevel: 4,
        staleAt: null,
      },
      data: { lastServedAt: new Date() },
    })
    .catch(() => null);
}

function snapshot(
  row: PatternTelemetrySnapshot,
): PatternTelemetrySnapshot {
  return {
    id: row.id,
    sourceDigest: row.sourceDigest,
    promotionLevel: row.promotionLevel,
    helpCount: row.helpCount,
    harmCount: row.harmCount,
    staleAt: row.staleAt,
    staleReason: row.staleReason,
    lastServedAt: row.lastServedAt,
  };
}

export async function recordPatternFeedback(opts: {
  observationId?: string;
  sourceDigest?: string;
  verdict: "help" | "harm";
  reasonKey?: string;
}): Promise<PatternTelemetrySnapshot> {
  if (opts.verdict !== "help" && opts.verdict !== "harm") {
    throw new Error("verdict must be help or harm.");
  }
  const row = opts.observationId
    ? await db.experienceObservation.findUnique({
        where: { id: opts.observationId },
      })
    : opts.sourceDigest
      ? await db.experienceObservation.findFirst({
          where: {
            sourceDigest: opts.sourceDigest,
            promotionLevel: 4,
          },
          orderBy: { createdAt: "desc" },
        })
      : null;
  if (!row) throw new Error("Pattern observation not found.");

  const helpCount = row.helpCount + (opts.verdict === "help" ? 1 : 0);
  const harmCount = row.harmCount + (opts.verdict === "harm" ? 1 : 0);
  const autoStale = shouldAutoStaleFromTelemetry(helpCount, harmCount);
  const updated = await db.experienceObservation.update({
    where: { id: row.id },
    data: {
      helpCount,
      harmCount,
      ...(autoStale && !row.staleAt
        ? {
            staleAt: new Date(),
            staleReason: opts.reasonKey
              ? normalizeStaleReason(opts.reasonKey)
              : "harm_threshold_exceeded",
          }
        : {}),
    },
  });
  return snapshot(updated);
}

export async function markPatternStale(opts: {
  observationId: string;
  reasonKey: string;
}): Promise<PatternTelemetrySnapshot> {
  const updated = await db.experienceObservation.update({
    where: { id: opts.observationId },
    data: {
      staleAt: new Date(),
      staleReason: normalizeStaleReason(opts.reasonKey),
    },
  });
  return snapshot(updated);
}

export async function clearPatternStale(opts: {
  observationId: string;
}): Promise<PatternTelemetrySnapshot> {
  const updated = await db.experienceObservation.update({
    where: { id: opts.observationId },
    data: { staleAt: null, staleReason: "" },
  });
  return snapshot(updated);
}

export async function invalidatePatternsForAuthorityKey(opts: {
  authorityKey: string;
  reasonKey?: string;
}): Promise<{ marked: number }> {
  const authorityKey = String(opts.authorityKey || "")
    .trim()
    .toLowerCase();
  if (!isInstitutionalKey(authorityKey)) {
    throw new Error(
      "authorityKey must be an institutional snake_case key.",
    );
  }
  const staleReason = opts.reasonKey
    ? normalizeStaleReason(opts.reasonKey)
    : "authority_source_changed";
  const rows = await db.experienceObservation.findMany({
    where: { promotionLevel: 4, staleAt: null },
    select: { id: true, anonJson: true },
    take: 500,
  });
  let marked = 0;
  for (const row of rows) {
    try {
      const anon = JSON.parse(row.anonJson) as {
        authority_ids?: string[];
        outcome?: { authority_keys?: string[] };
      };
      const keys = [
        ...(anon.authority_ids ?? []),
        ...(anon.outcome?.authority_keys ?? []),
      ].map((key) => key.toLowerCase());
      if (!keys.includes(authorityKey)) continue;
      await db.experienceObservation.update({
        where: { id: row.id },
        data: { staleAt: new Date(), staleReason },
      });
      marked += 1;
    } catch {
      // Ignore corrupt rows.
    }
  }
  return { marked };
}

export function filterServableProductionRows<
  T extends {
    promotionLevel: number;
    staleAt: Date | null;
    anonJson: string;
  },
>(rows: T[]): T[] {
  return rows.filter(isActivelyServable);
}
