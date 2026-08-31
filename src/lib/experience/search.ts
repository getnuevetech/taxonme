/**
 * Phase −1.9 L6 — Experience Search.
 * Only L4 Production patterns are accepted. No live fine-tuning.
 */
import {
  assertSafeForSharedExperience,
  type AnonymizedExperienceRecord,
} from "./deidentify";
import { listProductionPatterns } from "./publish";

export type ExperienceSearchQuery = {
  decisionTarget?: string;
  workspace?: string;
  factKeys?: string[];
  pathways?: string[];
  negativeLessonIds?: string[];
  limit?: number;
};

export type ExperienceSearchHit = {
  pattern: AnonymizedExperienceRecord;
  score: number;
  match_reasons: string[];
};

export const EXPERIENCE_SEARCH_PRECEDENCE =
  "CURRENT AUTHORITY > REVIEWED INTERNAL RULE > VALIDATED PRODUCTION PATTERN > HISTORICAL EXPERIENCE > MODEL INFERENCE";

export function assertAllProductionLevel(
  patterns: AnonymizedExperienceRecord[],
): void {
  for (const pattern of patterns) {
    assertSafeForSharedExperience(pattern);
    if (pattern.promotion_level !== 4) {
      throw new Error(
        `Experience Search refuses non-production pattern (promotion_level=${pattern.promotion_level}). Only level 4 is allowed.`,
      );
    }
  }
}

function overlapCount(
  first: string[] | undefined,
  second: string[] | undefined,
): number {
  if (!first?.length || !second?.length) return 0;
  const values = new Set(second.map((item) => item.toLowerCase()));
  return first.filter((item) => values.has(item.toLowerCase())).length;
}

export function rankProductionPatterns(
  patterns: AnonymizedExperienceRecord[],
  query: ExperienceSearchQuery,
): ExperienceSearchHit[] {
  assertAllProductionLevel(patterns);
  const target = (query.decisionTarget || "").toLowerCase();
  const workspace = (query.workspace || "").toLowerCase();
  const hits: ExperienceSearchHit[] = [];

  for (const pattern of patterns) {
    let score = 0;
    const match_reasons: string[] = [];
    const patternTarget = pattern.decision_target.toLowerCase();
    if (target && patternTarget === target) {
      score += 5;
      match_reasons.push("decision_target");
    } else if (target && patternTarget.includes(target.slice(0, 12))) {
      score += 2;
      match_reasons.push("decision_target_partial");
    }
    if (workspace && pattern.workspace.toLowerCase() === workspace) {
      score += 2;
      match_reasons.push("workspace");
    }
    const factOverlap = overlapCount(query.factKeys, [
      ...(pattern.decision_changing_facts || []),
      ...(pattern.facts_considered || []),
      ...(pattern.facts_discarded || []),
    ]);
    if (factOverlap) {
      score += factOverlap;
      match_reasons.push(`facts:${factOverlap}`);
    }
    const pathwayOverlap = overlapCount(
      query.pathways,
      pattern.pathways_considered,
    );
    if (pathwayOverlap) {
      score += pathwayOverlap * 2;
      match_reasons.push(`pathways:${pathwayOverlap}`);
    }
    const lessonOverlap = overlapCount(
      query.negativeLessonIds,
      pattern.negative_lesson_ids,
    );
    if (lessonOverlap) {
      score += lessonOverlap * 3;
      match_reasons.push(`lessons:${lessonOverlap}`);
    }
    if (pattern.correction || pattern.has_reviewer_correction) {
      score += 1;
      match_reasons.push("consultant_correction");
    }
    if (pattern.outcome || pattern.outcome_kind) {
      score += 1;
      match_reasons.push("government_outcome");
    }
    if (score > 0) hits.push({ pattern, score, match_reasons });
  }

  return hits
    .sort((first, second) => second.score - first.score)
    .slice(0, query.limit ?? 5);
}

export function formatExperienceSearchBlock(
  hits: ExperienceSearchHit[],
): string {
  if (!hits.length) return "";
  assertAllProductionLevel(hits.map((hit) => hit.pattern));
  const lines = [
    "=== VALIDATED PRODUCTION PATTERNS (Experience Search) ===",
    `Precedence: ${EXPERIENCE_SEARCH_PRECEDENCE}.`,
    "Institutional patterns are not law. Outcome ≠ law; current authority controls conflicts.",
    "Do not infer customer identities, account numbers, or free-text facts from patterns.",
    "",
  ];
  hits.forEach(({ pattern, score, match_reasons }, index) => {
    lines.push(
      `[${index + 1}] decision_target=${pattern.decision_target} workspace=${pattern.workspace} score=${score}`,
      `  match: ${match_reasons.join(", ")}`,
    );
    if (pattern.decision_changing_facts.length) {
      lines.push(
        `  decision_changing: ${pattern.decision_changing_facts.join(", ")}`,
      );
    }
    if (pattern.facts_discarded.length) {
      lines.push(
        `  discard_early: ${pattern.facts_discarded.slice(0, 8).join(", ")}`,
      );
    }
    if (pattern.clarification_key) {
      lines.push(
        `  preferred_clarification_key: ${pattern.clarification_key}`,
      );
    }
    if (pattern.negative_lesson_ids.length) {
      lines.push(
        `  negative_lessons: ${pattern.negative_lesson_ids.join(", ")}`,
      );
    }
    if (pattern.correction) {
      lines.push(
        `  correction: ${pattern.correction.incorrect_key} → ${pattern.correction.preferred_key} (${pattern.correction.failure_type})`,
      );
    }
    if (pattern.outcome) {
      lines.push(
        `  outcome_signal: ${pattern.outcome.outcome_kind} / ${pattern.outcome.form_or_notice_key} (historical_experience only)`,
      );
    }
    lines.push("");
  });
  return lines.join("\n").trim();
}

export async function searchProductionExperience(
  query: ExperienceSearchQuery,
): Promise<ExperienceSearchHit[]> {
  const limit = query.limit ?? 5;
  const patterns = await listProductionPatterns(
    Math.max(20, limit * 4),
  );
  assertAllProductionLevel(patterns);
  const hits = rankProductionPatterns(patterns, { ...query, limit });
  if (hits.length) {
    try {
      const { recordPatternServed } = await import("./telemetry");
      await recordPatternServed({
        sourceDigests: hits.map((hit) => hit.pattern.source_digest),
      });
    } catch {
      // Telemetry is best-effort and must not block reasoning.
    }
  }
  return hits;
}

export async function buildExperienceSearchBlock(
  query: ExperienceSearchQuery,
): Promise<string> {
  try {
    return formatExperienceSearchBlock(
      await searchProductionExperience(query),
    );
  } catch {
    return "";
  }
}

export function productionPatternAskHints(
  hits: ExperienceSearchHit[],
): {
  suppress_keys: string[];
  prefer_keys: string[];
  negative_lesson_ids: string[];
} {
  const suppress = new Set<string>();
  const prefer = new Set<string>();
  const lessons = new Set<string>();
  for (const { pattern } of hits) {
    pattern.facts_discarded.forEach((key) => suppress.add(key));
    pattern.clarifications_suppressed.forEach((key) => suppress.add(key));
    if (pattern.clarification_key) prefer.add(pattern.clarification_key);
    pattern.decision_changing_facts.forEach((key) => prefer.add(key));
    if (pattern.correction) {
      suppress.add(pattern.correction.incorrect_key);
      prefer.add(pattern.correction.preferred_key);
    }
    pattern.negative_lesson_ids.forEach((id) => lessons.add(id));
  }
  return {
    suppress_keys: [...suppress],
    prefer_keys: [...prefer],
    negative_lesson_ids: [...lessons],
  };
}
