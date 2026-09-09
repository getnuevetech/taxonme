/**
 * Package T — Historical Case ConversationIntelligence backfill.
 * Empty/unparseable Case.intelligenceJson only; reuses Package R re-enrich.
 */
import "server-only";
import { db } from "@/lib/db";
import { parseStoredIntelligence } from "@/lib/conversation";
import { reenrichEntityIntelligence } from "@/lib/admin/intelligence-reenrich";

export function needsIntelligenceBackfill(raw: string | null | undefined): boolean {
  return !parseStoredIntelligence(raw);
}

export type CaseIntelligenceBackfillOptions = {
  dryRun?: boolean;
  /** Max Cases to scan this page (default 50, max 500). */
  limit?: number;
  /** Optional single Case id. */
  caseId?: string;
  /** Cursor id for paging (exclusive). */
  cursor?: string;
};

export type CaseIntelligenceBackfillResult = {
  dryRun: boolean;
  scanned: number;
  eligible: number;
  written: number;
  skipped: number;
  failed: number;
  nextCursor: string | null;
  failures: Array<{ id: string; error: string }>;
};

export async function backfillEmptyCaseIntelligence(
  opts: CaseIntelligenceBackfillOptions = {},
): Promise<CaseIntelligenceBackfillResult> {
  const dryRun = Boolean(opts.dryRun);
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 500);
  const caseId = opts.caseId?.trim() || "";
  const cursor = opts.cursor?.trim() || "";

  const rows = caseId
    ? await db.case.findMany({
        where: { id: caseId },
        select: { id: true, intelligenceJson: true },
        take: 1,
      })
    : await db.case.findMany({
        select: { id: true, intelligenceJson: true },
        orderBy: { id: "asc" },
        take: limit,
        ...(cursor
          ? {
              skip: 1,
              cursor: { id: cursor },
            }
          : {}),
      });

  const result: CaseIntelligenceBackfillResult = {
    dryRun,
    scanned: rows.length,
    eligible: 0,
    written: 0,
    skipped: 0,
    failed: 0,
    nextCursor: rows.length === limit && !caseId ? rows[rows.length - 1]?.id ?? null : null,
    failures: [],
  };

  for (const row of rows) {
    if (!needsIntelligenceBackfill(row.intelligenceJson)) {
      result.skipped += 1;
      continue;
    }
    result.eligible += 1;
    if (dryRun) continue;

    const enrich = await reenrichEntityIntelligence({ kind: "case", id: row.id });
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

export function formatBackfillSummary(result: CaseIntelligenceBackfillResult): string {
  const mode = result.dryRun ? "dry-run" : "apply";
  return [
    `Case intel backfill (${mode}): scanned=${result.scanned}`,
    `eligible=${result.eligible}`,
    `written=${result.written}`,
    `skipped=${result.skipped}`,
    `failed=${result.failed}`,
    result.nextCursor ? `nextCursor=${result.nextCursor}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
