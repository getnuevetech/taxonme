import "server-only";
import { db } from "./db";
import { normalizeConcept } from "./case-semantics";

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function moneyMentions(text: string): { raw: string; value: number | null }[] {
  return Array.from(text.matchAll(/\$?\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\b/g))
    .map((m) => m[0])
    .filter((raw) => !/^20\d{2}$/.test(raw))
    .slice(0, 20)
    .map((raw) => ({ raw, value: Number(raw.replace(/[$,]/g, "")) || null }));
}

function dateMentions(text: string): string[] {
  return unique([
    ...(text.match(/\b20\d{2}\b/g) ?? []),
    ...(text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) ?? []),
    ...(text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+20\d{2}\b/gi) ?? []),
  ]).slice(0, 30);
}

function noticeMentions(text: string): string[] {
  return unique((text.toUpperCase().match(/\b(?:CP|LT|LTR)\s?-?\d{2,5}\b/g) ?? []).map((v) => v.replace(/\s|-/g, "")));
}

function likelyDocuments(text: string): string[] {
  const docs = new Set<string>();
  if (/\bnotice|letter|cp\d+|lt\d+/i.test(text)) docs.add("IRS notice or letter");
  if (/\btranscript|account record|irs account/i.test(text)) docs.add("IRS account transcript");
  if (/\breturn|1040|amended/i.test(text)) docs.add("Tax return");
  if (/\bw-?2|1099|income|withholding/i.test(text)) docs.add("Income statement or withholding record");
  if (/\bpayment|paid|installment|bank/i.test(text)) docs.add("Payment confirmation or bank record");
  return Array.from(docs);
}

function proposedIssue(text: string): { issue_category: string; proposed_label: string; evidence: string } {
  const normalized = normalizeConcept(text);
  if (normalized.normalized_category !== "UNCLASSIFIED") {
    return {
      issue_category: normalized.normalized_category,
      proposed_label: normalized.normalized_meaning,
      evidence: text.slice(0, 500),
    };
  }
  return {
    issue_category: "UNCLASSIFIED_TAX_ISSUE",
    proposed_label: "Unclassified tax issue requiring evidence and authority review",
    evidence: text.slice(0, 500),
  };
}

export async function buildCaseDiscovery(caseId: string) {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      documents: { where: { deletedAt: null } },
      issues: true,
      clarifyMessages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c) return null;
  const text = [
    c.situation,
    c.goal,
    ...c.clarifyMessages.map((m) => m.content),
    ...c.documents.map((d) => `${d.docKind} ${d.fileName}`),
  ].join("\n");
  const normalizedGoal = c.goal ? normalizeConcept(c.goal) : null;
  return {
    case_id: c.id,
    reported_events: c.situation ? [{ text: c.situation, source_id: "case.situation" }] : [],
    affected_tax_periods: unique(dateMentions(text).filter((v) => /^20\d{2}$/.test(v))),
    affected_entities: [],
    reported_notices: noticeMentions(text),
    reported_amounts: moneyMentions(text),
    reported_irs_actions: [],
    user_concerns: c.situation ? [c.situation.slice(0, 500)] : [],
    user_goals: normalizedGoal ? [normalizedGoal] : [],
    possible_issue_categories: unique([
      proposedIssue(text).issue_category,
      ...c.issues.map((i) => i.issueType || "UNCLASSIFIED_TAX_ISSUE"),
    ]),
    proposed_issues: [proposedIssue(text)],
    missing_information: c.issues.flatMap((i) => {
      try {
        const parsed = JSON.parse(i.unclearJson || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }),
    documents_likely_to_matter: likelyDocuments(text),
  };
}

export async function recordCaseDiscovery(caseId: string, caseVersion: number): Promise<void> {
  const discovery = await buildCaseDiscovery(caseId);
  if (!discovery) return;
  await db.caseDiscovery.upsert({
    where: { caseId_caseVersion: { caseId, caseVersion } },
    update: { discoveryJson: JSON.stringify(discovery) },
    create: { caseId, caseVersion, discoveryJson: JSON.stringify(discovery) },
  });
}
