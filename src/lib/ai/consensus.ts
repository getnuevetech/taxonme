import "server-only";

// Deterministic consensus engine. Merges structured outputs from multiple
// models, flags disagreements as conflicts (the platform never guesses),
// and computes deterministic indicators such as case readiness.
//
// Package A: prose / free-text fields use semantic equivalence — synonymous
// situation summaries are CONSISTENT, not NEEDS_CONFIRMATION.

import { normalizeConcept, isMaterialDifference } from "@/lib/case-semantics";

export type Conflict = {
  field: string;
  values: { source: string; value: unknown }[];
  note: string;
};

type Json = Record<string, unknown>;

/** Keys where wording differences are not material fact conflicts. */
export const PROSE_CONSENSUS_KEYS = new Set([
  "situation_summary",
  "primary_goal",
  "user_goal",
  "user_reported_goal",
  "interpreted_objective",
  "headline",
  "summary",
  "what_we_know",
  "our_conclusion",
  "description",
  "title",
  "detail",
  "appears_possible",
]);

function normalize(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  return String(v).trim().toLowerCase().replace(/[,$\s]+/g, " ").trim();
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * True when two values mean the same thing for consensus purposes.
 * Used for prose fields so "owes unspecified amount" vs "owes, no documents"
 * does not become a customer-facing conflict.
 */
export function semanticEquivalence(a: unknown, b: unknown, key: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (!na || !nb) return false;

  if (PROSE_CONSENSUS_KEYS.has(key) || !isMaterialDifference(key)) {
    const ca = normalizeConcept(String(a));
    const cb = normalizeConcept(String(b));
    if (
      ca.normalized_category !== "UNCLASSIFIED" &&
      ca.normalized_category === cb.normalized_category
    ) {
      return true;
    }
    if (jaccard(tokenize(na), tokenize(nb)) >= 0.45) return true;
  }
  return false;
}

function pickCanonicalProse(present: { source: string; value: unknown }[]): unknown {
  // Prefer the longest non-empty string (usually the more complete summary).
  let best = present[0].value;
  let bestLen = normalize(best).length;
  for (const p of present.slice(1)) {
    const len = normalize(p.value).length;
    if (len > bestLen) {
      best = p.value;
      bestLen = len;
    }
  }
  return best;
}

/**
 * Merge multiple parsed model outputs field-by-field.
 * - Fields where all sources agree (or only one source provided a value) merge directly.
 * - Prose fields with synonymous wording merge without conflict.
 * - Material fact disagreements produce a conflict entry.
 * - Array fields are unioned.
 */
export function mergeStructured(outputs: { source: string; data: Json }[]): {
  merged: Json;
  conflicts: Conflict[];
} {
  const merged: Json = {};
  const conflicts: Conflict[] = [];
  const allKeys = new Set<string>();
  for (const o of outputs) Object.keys(o.data ?? {}).forEach((k) => allKeys.add(k));

  for (const key of allKeys) {
    const present = outputs
      .map((o) => ({ source: o.source, value: o.data?.[key] }))
      .filter((x) => x.value !== undefined && x.value !== null && x.value !== "");
    if (present.length === 0) continue;

    if (present.every((p) => Array.isArray(p.value))) {
      const union: unknown[] = [];
      const seen = new Set<string>();
      for (const p of present) {
        for (const item of p.value as unknown[]) {
          const sig = normalize(typeof item === "object" ? JSON.stringify(item) : item);
          if (!seen.has(sig)) {
            seen.add(sig);
            union.push(item);
          }
        }
      }
      merged[key] = union;
      continue;
    }

    const distinct = new Map<string, unknown>();
    for (const p of present) distinct.set(normalize(p.value), p.value);

    if (distinct.size === 1) {
      merged[key] = present[0].value;
      continue;
    }

    // Package A: prose / non-material keys — collapse synonyms instead of conflicting.
    const values = [...distinct.values()];
    let allEquivalent = true;
    for (let i = 1; i < values.length; i++) {
      if (!semanticEquivalence(values[0], values[i], key)) {
        allEquivalent = false;
        break;
      }
    }
    if (allEquivalent || (PROSE_CONSENSUS_KEYS.has(key) && !isMaterialDifference(key))) {
      // For prose keys, if pairwise equivalence failed but key is prose, still
      // prefer canonical pick when every pair shares high token overlap with first.
      if (allEquivalent) {
        merged[key] = pickCanonicalProse(present);
        continue;
      }
      if (PROSE_CONSENSUS_KEYS.has(key)) {
        const base = values[0];
        if (values.every((v) => semanticEquivalence(base, v, key) || jaccard(tokenize(normalize(base)), tokenize(normalize(v))) >= 0.35)) {
          merged[key] = pickCanonicalProse(present);
          continue;
        }
      }
    }

    // Material disagreement only when the field topic is material.
    if (!isMaterialDifference(key) && PROSE_CONSENSUS_KEYS.has(key)) {
      merged[key] = pickCanonicalProse(present);
      continue;
    }

    conflicts.push({
      field: key,
      values: present,
      note: "Sources disagree — verification required.",
    });
    merged[key] = { __conflict: true, candidates: present.map((p) => p.value) };
  }
  return { merged, conflicts };
}

/**
 * Superseded by computeReadinessDimensions in evidence/readiness-core, which
 * keeps our processing gaps out of the customer's score. Retained for the guest
 * flow, which has no evidence layer to draw on.
 */
export function computeReadiness(input: {
  documentsCount: number;
  documentsExpected: number;
  factsVerified: number;
  factsTotal: number;
  irsSourcesMatched: number;
  unresolvedConflicts: number;
  unknowns: number;
}): number {
  const docScore =
    input.documentsExpected > 0
      ? Math.min(1, input.documentsCount / input.documentsExpected) * 35
      : input.documentsCount > 0
        ? 35
        : 0;
  const factScore = input.factsTotal > 0 ? (input.factsVerified / input.factsTotal) * 35 : 0;
  const irsScore = Math.min(input.irsSourcesMatched, 3) * (15 / 3);
  const base = 15; // intake completed
  const penalty = input.unresolvedConflicts * 8 + input.unknowns * 3;
  const score = Math.round(docScore + factScore + irsScore + base - penalty);
  return Math.max(0, Math.min(100, score));
}
