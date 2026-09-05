import "server-only";
import { db } from "./db";
import { buildCanonicalCaseState } from "./canonical-case-state";
import {
  authoritySourceBlockedByGates,
  shouldNameFtaOrAep,
  shouldRetrieveInstallmentThresholds,
} from "./authority-gates";
import type { EvidenceSnapshot } from "./ai/evidence-proportional";

type Json = Record<string, unknown>;

function termsFrom(value: unknown): string[] {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 3 && !/^\d+$/.test(term));
}

function collectAuthorityQueries(state: Json | null, fallbackQuery: string): string[] {
  const queries = new Set<string>();
  if (fallbackQuery.trim()) queries.add(fallbackQuery);
  const issues = Array.isArray(state?.issues) ? (state.issues as Json[]) : [];
  const goals = Array.isArray(state?.goals) ? (state.goals as Json[]) : [];
  const discovery =
    typeof state?.discovery === "object" && state.discovery !== null ? (state.discovery as Json) : {};
  for (const issue of issues) {
    queries.add([issue.category, issue.title, ...(Array.isArray(issue.unknowns) ? issue.unknowns : [])].join(" "));
  }
  for (const goal of goals) queries.add([goal.raw_value, goal.normalized_category, goal.normalized_meaning].join(" "));
  if (Array.isArray(discovery.possible_issue_categories)) queries.add(discovery.possible_issue_categories.join(" "));
  if (Array.isArray(discovery.proposed_issues)) {
    for (const issue of discovery.proposed_issues as Json[]) {
      queries.add([issue.issue_category, issue.proposed_label].join(" "));
    }
  }
  return Array.from(queries).filter((query) => query.trim().length > 0).slice(0, 8);
}

function snapshotFromState(state: Json | null, fallbackQuery: string): EvidenceSnapshot & {
  amountCents?: number | null;
  userAskedInstallmentEducation?: boolean;
  caseTaxYear: number | null;
} {
  const issues = Array.isArray(state?.issues) ? (state.issues as Json[]) : [];
  const amounts = issues
    .map((i) => Number(i.expected_amount ?? i.amount ?? i.balance ?? NaN))
    .filter((n) => Number.isFinite(n) && n > 0);
  const years = issues.map((i) => Number(i.tax_year ?? i.taxYear ?? NaN)).filter((y) => y > 1990 && y < 2100);
  const q = fallbackQuery.toLowerCase();
  return {
    hasDocs: Boolean(state && Array.isArray((state as Json).documents) && ((state as Json).documents as unknown[]).length),
    hasTranscript: /transcript/i.test(JSON.stringify(state?.documents ?? "")),
    hasAmount: amounts.length > 0,
    hasTaxYear: years.length > 0,
    amountCents: amounts.length ? Math.round(amounts[0] * 100) : null,
    userAskedInstallmentEducation: /\b(installment|payment plan|9465|streamlined)\b/i.test(q),
    caseTaxYear: years.length ? years[years.length - 1] : null,
  };
}

export async function retrieveAuthorityForCase(
  caseId: string,
  fallbackQuery: string,
  limit = 6,
  evidenceHints?: Partial<EvidenceSnapshot> & { caseTaxYear?: number | null; amountCents?: number | null },
): Promise<{ text: string; sourceIds: string[]; queries: string[] }> {
  const state = await buildCanonicalCaseState(caseId);
  const queries = collectAuthorityQueries(state, fallbackQuery);
  const snap = { ...snapshotFromState(state, fallbackQuery), ...evidenceHints };
  const allowInstallmentThresholds = shouldRetrieveInstallmentThresholds(snap);
  const allowNamedRelief = shouldNameFtaOrAep(snap.caseTaxYear ?? null);
  const sources = await db.knowledgeSource.findMany({ where: { isActive: true } });
  const scored = new Map<string, { source: (typeof sources)[number]; score: number }>();
  for (const query of queries) {
    const terms = new Set(termsFrom(query));
    const codes = query.toUpperCase().match(/\b(CP|LT|LTR)\s?-?\d{2,5}\b/g) ?? [];
    for (const source of sources) {
      if (
        authoritySourceBlockedByGates(
          {
            title: source.title,
            tags: source.tags || "",
            content: source.content,
            taxYear: source.taxYear,
          },
          {
            allowInstallmentThresholds,
            allowNamedRelief,
            caseTaxYear: snap.caseTaxYear ?? null,
          },
        )
      ) {
        continue;
      }
      const hay = `${source.title} ${source.reference} ${source.sourceType} ${source.tags} ${source.content}`.toLowerCase();
      let score = 0;
      for (const term of terms) if (hay.includes(term)) score++;
      for (const code of codes) if (hay.toUpperCase().includes(code.replace(/\s|-/g, ""))) score += 10;
      if (score === 0) continue;
      const existing = scored.get(source.id);
      if (!existing || score > existing.score) scored.set(source.id, { source, score });
    }
  }
  const ranked = Array.from(scored.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return {
    text: ranked
      .map(({ source }) =>
        [
          `[${source.reference || source.sourceType}] ${source.title}`,
          `source_id: ${source.id}`,
          `authority_type: ${source.sourceType}`,
          source.taxYear ? `tax_year_applicability: ${source.taxYear}` : "",
          source.url ? `url: ${source.url}` : "",
          source.content.slice(0, 2500),
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n---\n\n"),
    sourceIds: ranked.map(({ source }) => source.id),
    queries,
  };
}
