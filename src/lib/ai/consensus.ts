import "server-only";

// Deterministic consensus engine. Merges structured outputs from multiple
// models, flags disagreements as conflicts (the platform never guesses),
// and computes deterministic indicators such as case readiness.

export type Conflict = {
  field: string;
  values: { source: string; value: unknown }[];
  note: string;
};

type Json = Record<string, unknown>;

function normalize(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(Math.round(v * 100) / 100);
  return String(v).trim().toLowerCase().replace(/[,$\s]+/g, " ").trim();
}

/**
 * Merge multiple parsed model outputs field-by-field.
 * - Fields where all sources agree (or only one source provided a value) merge directly.
 * - Fields with disagreement produce a conflict entry and are marked for verification.
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
    } else {
      conflicts.push({
        field: key,
        values: present,
        note: "Sources disagree — verification required.",
      });
      merged[key] = { __conflict: true, candidates: present.map((p) => p.value) };
    }
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
