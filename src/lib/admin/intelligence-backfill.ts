/**
 * Package T — Historical Case ConversationIntelligence backfill.
 * Package W — Situation / QaThread empty-intelligence backfill.
 * Empty/unparseable intelligenceJson only; reuses Package R re-enrich.
 */
import "server-only";
import { db } from "@/lib/db";
import { parseStoredIntelligence } from "@/lib/conversation";
import { reenrichEntityIntelligence, type ReenrichKind } from "@/lib/admin/intelligence-reenrich";

export function needsIntelligenceBackfill(raw: string | null | undefined): boolean {
  return !parseStoredIntelligence(raw);
}

export type IntelligenceBackfillKind = ReenrichKind;

export type IntelligenceBackfillOptions = {
  dryRun?: boolean;
  /** Max rows to scan this page (default 50, max 500). */
  limit?: number;
  /** Optional single entity id. */
  entityId?: string;
  /** Cursor id for paging (exclusive). */
  cursor?: string;
};

export type IntelligenceBackfillResult = {
  kind: IntelligenceBackfillKind;
  dryRun: boolean;
  scanned: number;
  eligible: number;
  written: number;
  skipped: number;
  failed: number;
  nextCursor: string | null;
  failures: Array<{ id: string; error: string }>;
};

/** @deprecated Prefer entityId; kept for Package T CLI/action compatibility. */
export type CaseIntelligenceBackfillOptions = Omit<IntelligenceBackfillOptions, "entityId"> & {
  caseId?: string;
};

export type CaseIntelligenceBackfillResult = IntelligenceBackfillResult;

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

export async function backfillEmptyIntelligence(
  kind: IntelligenceBackfillKind,
  opts: IntelligenceBackfillOptions = {},
): Promise<IntelligenceBackfillResult> {
  const dryRun = Boolean(opts.dryRun);
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 500);
  const entityId = opts.entityId?.trim() || "";
  const cursor = opts.cursor?.trim() || "";

  const rows = await loadRows(kind, { entityId, cursor, limit });

  const result: IntelligenceBackfillResult = {
    kind,
    dryRun,
    scanned: rows.length,
    eligible: 0,
    written: 0,
    skipped: 0,
    failed: 0,
    nextCursor: rows.length === limit && !entityId ? rows[rows.length - 1]?.id ?? null : null,
    failures: [],
  };

  for (const row of rows) {
    if (!needsIntelligenceBackfill(row.intelligenceJson)) {
      result.skipped += 1;
      continue;
    }
    result.eligible += 1;
    if (dryRun) continue;

    const enrich = await reenrichEntityIntelligence({ kind, id: row.id });
    if (!enrich.ok) {
      result.failed += 1;
      result.failures.push({ id: row.id, error: enrich.error });
      continue;
    }
    // Defense in depth: never leave an unparseable write (R already gates this).
    if (!parseStoredIntelligence(enrich.intelligenceJson)) {
      result.failed += 1;
      result.failures.push({
        id: row.id,
        error: "Re-enrich returned unparseable intelligence; left stored JSON unchanged.",
      });
      continue;
    }
    result.written += 1;
  }

  return result;
}

export async function backfillEmptyCaseIntelligence(
  opts: CaseIntelligenceBackfillOptions = {},
): Promise<CaseIntelligenceBackfillResult> {
  return backfillEmptyIntelligence("case", {
    dryRun: opts.dryRun,
    limit: opts.limit,
    cursor: opts.cursor,
    entityId: opts.caseId,
  });
}

export async function backfillEmptySituationIntelligence(
  opts: IntelligenceBackfillOptions = {},
): Promise<IntelligenceBackfillResult> {
  return backfillEmptyIntelligence("situation", opts);
}

export async function backfillEmptyQaThreadIntelligence(
  opts: IntelligenceBackfillOptions = {},
): Promise<IntelligenceBackfillResult> {
  return backfillEmptyIntelligence("qa_thread", opts);
}

export function formatBackfillSummary(result: IntelligenceBackfillResult): string {
  const mode = result.dryRun ? "dry-run" : "apply";
  const label =
    result.kind === "case"
      ? "Case"
      : result.kind === "situation"
        ? "Situation"
        : "QaThread";
  return [
    `${label} intel backfill (${mode}): scanned=${result.scanned}`,
    `eligible=${result.eligible}`,
    `written=${result.written}`,
    `skipped=${result.skipped}`,
    `failed=${result.failed}`,
    result.nextCursor ? `nextCursor=${result.nextCursor}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
