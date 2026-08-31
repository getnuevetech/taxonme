/**
 * Phase −1.9 L5 — reviewed promotion ladder for de-identified patterns.
 */
import { db } from "@/lib/db";
import {
  assertSafeForSharedExperience,
  type AnonymizedExperienceRecord,
  type PromotionLevel,
} from "./deidentify";

export type { PromotionLevel };
export const PROMOTION_LABELS: Record<PromotionLevel, string> = {
  0: "Observation",
  1: "Candidate",
  2: "Supported",
  3: "Reviewed",
  4: "Production",
};
export const PROMOTION_LEVELS: PromotionLevel[] = [0, 1, 2, 3, 4];

export type RegistryEntry = {
  id: string;
  promotionLevel: PromotionLevel;
  decisionTarget: string;
  workspace: string;
  createdAt: Date;
  sourceSituationId: string | null;
  anon: AnonymizedExperienceRecord;
  helpCount: number;
  harmCount: number;
  staleAt: Date | null;
  staleReason: string;
  lastServedAt: Date | null;
};

export function isPromotionLevel(value: unknown): value is PromotionLevel {
  return (
    value === 0 ||
    value === 1 ||
    value === 2 ||
    value === 3 ||
    value === 4
  );
}

export function parsePromotionLevel(raw: unknown): PromotionLevel {
  const value = Number(raw);
  if (!isPromotionLevel(value)) {
    throw new Error("Promotion level must be an integer 0–4.");
  }
  return value;
}

export function canPromoteToProduction(
  anon: AnonymizedExperienceRecord,
): { ok: boolean; reason: string } {
  if (!anon.decision_target?.trim()) {
    return {
      ok: false,
      reason: "Production patterns require a decision_target.",
    };
  }
  const hasSignal =
    anon.has_reviewer_correction ||
    Boolean(anon.outcome_kind) ||
    Boolean(anon.correction) ||
    Boolean(anon.outcome) ||
    (anon.negative_lesson_ids?.length ?? 0) > 0 ||
    (anon.decision_changing_facts?.length ?? 0) > 0;
  return hasSignal
    ? {
        ok: true,
        reason:
          "Eligible for Production; current authority still takes precedence.",
      }
    : {
        ok: false,
        reason:
          "Production requires a correction, outcome, negative lesson, or decision-changing fact.",
      };
}

export function validatePromotionTarget(
  anon: AnonymizedExperienceRecord,
  toLevel: PromotionLevel,
): { ok: boolean; reason: string } {
  if (!isPromotionLevel(toLevel)) {
    return { ok: false, reason: "Invalid promotion level." };
  }
  return toLevel === 4
    ? canPromoteToProduction(anon)
    : {
        ok: true,
        reason: `May set level to ${toLevel} (${PROMOTION_LABELS[toLevel]}).`,
      };
}

function parseAnon(raw: string): AnonymizedExperienceRecord {
  const anon = JSON.parse(raw) as AnonymizedExperienceRecord;
  assertSafeForSharedExperience(anon);
  return anon;
}

export async function listRegistryEntries(opts?: {
  level?: PromotionLevel | "all";
  decisionTarget?: string;
  limit?: number;
}): Promise<RegistryEntry[]> {
  const level = opts?.level ?? "all";
  const rows = await db.experienceObservation.findMany({
    where: {
      ...(level === "all" ? {} : { promotionLevel: level }),
      ...(opts?.decisionTarget
        ? { decisionTarget: opts.decisionTarget }
        : {}),
    },
    orderBy: [{ promotionLevel: "desc" }, { createdAt: "desc" }],
    take: opts?.limit ?? 100,
  });

  const entries: RegistryEntry[] = [];
  for (const row of rows) {
    try {
      const promotionLevel = isPromotionLevel(row.promotionLevel)
        ? row.promotionLevel
        : 0;
      entries.push({
        id: row.id,
        promotionLevel,
        decisionTarget: row.decisionTarget,
        workspace: row.workspace,
        createdAt: row.createdAt,
        sourceSituationId: row.sourceSituationId,
        anon: {
          ...parseAnon(row.anonJson),
          promotion_level: promotionLevel,
        },
        helpCount: row.helpCount,
        harmCount: row.harmCount,
        staleAt: row.staleAt,
        staleReason: row.staleReason,
        lastServedAt: row.lastServedAt,
      });
    } catch {
      // Corrupt or unsafe payloads are omitted from the registry.
    }
  }
  return entries;
}

export async function countRegistryByLevel(): Promise<
  Record<PromotionLevel, number>
> {
  const groups = await db.experienceObservation.groupBy({
    by: ["promotionLevel"],
    _count: { _all: true },
  });
  const counts: Record<PromotionLevel, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
  for (const group of groups) {
    if (isPromotionLevel(group.promotionLevel)) {
      counts[group.promotionLevel] = group._count._all;
    }
  }
  return counts;
}

export async function setPatternPromotionLevel(opts: {
  id: string;
  toLevel: PromotionLevel;
}): Promise<{
  id: string;
  fromLevel: PromotionLevel;
  toLevel: PromotionLevel;
  anon: AnonymizedExperienceRecord;
}> {
  const toLevel = parsePromotionLevel(opts.toLevel);
  const row = await db.experienceObservation.findUnique({
    where: { id: opts.id },
  });
  if (!row) throw new Error("Pattern observation not found.");
  const anon = parseAnon(row.anonJson);
  const fromLevel = isPromotionLevel(row.promotionLevel)
    ? row.promotionLevel
    : 0;
  const gate = validatePromotionTarget(anon, toLevel);
  if (!gate.ok) throw new Error(gate.reason);
  const nextAnon: AnonymizedExperienceRecord = {
    ...anon,
    promotion_level: toLevel,
  };
  assertSafeForSharedExperience(nextAnon);
  await db.experienceObservation.update({
    where: { id: row.id },
    data: {
      promotionLevel: toLevel,
      anonJson: JSON.stringify(nextAnon),
    },
  });
  return { id: row.id, fromLevel, toLevel, anon: nextAnon };
}
