import { formatCaseNumber } from "@/lib/case-number";

/** Customer-facing Situation reference — never labeled as a Case TOM- id. */
export function formatSituationNumber(n: number): string {
  return `SIT-${String(n).padStart(6, "0")}`;
}

export function situationTitleFromNarrative(narrative: string, explicitQuestion?: string): string {
  const q = (explicitQuestion || "").trim();
  if (q) return q.slice(0, 80);
  return narrative.trim().slice(0, 80) || "Tax situation";
}

/** Prefer Situation number in chrome; never present as TOM Case for Situations. */
export function situationRefLabel(number: number): string {
  return `Situation ${formatSituationNumber(number)}`;
}

export function legacyCaseRefForAudit(caseNumber: number): string {
  return formatCaseNumber(caseNumber);
}
