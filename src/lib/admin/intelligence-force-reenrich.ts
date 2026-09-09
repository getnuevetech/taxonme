/**
 * Package X — Force overwrite ConversationIntelligence re-enrich.
 * Parseable intelligenceJson only (opposite of T/W empty-only); reuses Package R.
 */
import "server-only";
import { db } from "@/lib/db";
import { parseStoredIntelligence } from "@/lib/conversation";
import { reenrichEntityIntelligence, type ReenrichKind } from "@/lib/admin/intelligence-reenrich";
import type { IntelligenceBackfillKind, IntelligenceBackfillResult } from "@/lib/admin/intelligence-backfill";

export type ForceReenrichOptions = {
  /** Required for apply (non-dry-run). Dry-run may scan without force. */
  force?: boolean;
  dryRun?: boolean;
  limit?: number;
  entityId?: string;
  cursor?: string;
};

export type ForceReenrichResult = IntelligenceBackfillResult & {
  force: boolean;
};

/** Eligible for force overwrite = already has a parseable snapshot. */
export function isForceReenrichEligible(raw: string | null | undefined): boolean {
  return Boolean(parseStoredIntelligence(raw));
}

async function loadRows(
  kind: IntelligenceBackfillKind,
  opts: { entityId: string; cursor: string; limit: number },
): Promise<Array<{ id: string; intelligenceJson: string }>> {
  const select = { id: true, intelligenceJson: true } as const;
  if (opts.entityId) {
    if (kind === "case") {
      return db.case.findMany({ where: { id: opts.entityId }, select, take: 1 });
    }
    if (kind === "situation") {
      return db.situation.findMany({ where: { id: opts.entityId }, select, take: 1 });
    }
    return db.qaThread.findMany({ where: { id: opts.entityId }, select, take: 1 });
  }

  const page = {
    select,
    orderBy: { id: "asc" as const },
    take: opts.limit,
    ...(opts.cursor
      ? {
          skip: 1,
          cursor: { id: opts.cursor },
        }
      : {}),
  };

  if (kind === "case") return db.case.findMany(page);
  if (kind === "situation") return db.situation.findMany(page);
  return db.qaThread.findMany(page);
}

/**
 * Force re-enrich entities that already have parseable intelligenceJson.
 * Apply requires `force: true`. Empty/unparseable rows are skipped (use T/W).
 */
export async function forceReenrichIntelligence(
  kind: ReenrichKind,
  opts: ForceReenrichOptions = {},
): Promise<ForceReenrichResult> {
  const dryRun = Boolean(opts.dryRun);
  const force = Boolean(opts.force);
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 500);
  const entityId = opts.entityId?.trim() || "";
  const cursor = opts.cursor?.trim() || "";

  if (!dryRun && !force) {
    return {
      kind,
      dryRun,
      force: false,
      scanned: 0,
      eligible: 0,
      written: 0,
      skipped: 0,
      failed: 1,
      nextCursor: null,
      failures: [
        {
          id: entityId || "(batch)",
          error: "Force overwrite requires force=true (or --force) when applying.",
        },
      ],
    };
  }

  const rows = await loadRows(kind, { entityId, cursor, limit });

  const result: ForceReenrichResult = {
    kind,
    dryRun,
    force,
    scanned: rows.length,
    eligible: 0,
    written: 0,
    skipped: 0,
    failed: 0,
    nextCursor: rows.length === limit && !entityId ? rows[rows.length - 1]?.id ?? null : null,
    failures: [],
  };

  for (const row of rows) {
    if (!isForceReenrichEligible(row.intelligenceJson)) {
      result.skipped += 1;
      continue;
    }
    result.eligible += 1;
    if (dryRun) continue;

    const prior = row.intelligenceJson;
    const enrich = await reenrichEntityIntelligence({ kind, id: row.id });
    if (!enrich.ok) {
      result.failed += 1;
      result.failures.push({ id: row.id, error: enrich.error });
      continue;
    }
    if (!parseStoredIntelligence(enrich.intelligenceJson)) {
      result.failed += 1;
      result.failures.push({
        id: row.id,
        error: "Re-enrich returned unparseable intelligence; left stored JSON unchanged.",
      });
      continue;
    }
    // Count as written even if content equals prior — R still ran and persisted.
    void prior;
    result.written += 1;
  }

  return result;
}

export function formatForceReenrichSummary(result: ForceReenrichResult): string {
  const mode = result.dryRun ? "dry-run" : "apply";
  const label =
    result.kind === "case"
      ? "Case"
      : result.kind === "situation"
        ? "Situation"
        : "QaThread";
  return [
    `${label} intel force-reenrich (${mode}): scanned=${result.scanned}`,
    `eligible=${result.eligible}`,
    `written=${result.written}`,
    `skipped=${result.skipped}`,
    `failed=${result.failed}`,
    result.force ? "force=1" : "force=0",
    result.nextCursor ? `nextCursor=${result.nextCursor}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
