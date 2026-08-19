import "server-only";
import { db } from "../db";
import { formatEvidenceBrief, type EvidenceBrief } from "./brief-core";

const EMPTY_BRIEF: EvidenceBrief = {
  hasEvidence: false,
  establishedPositions: [],
  establishedFacts: [],
  reportedNotEstablished: [],
  openUnknowns: [],
  limitations: [],
  statableAmounts: [],
  text: "ESTABLISHED EVIDENCE: no case is linked to this request, so nothing is established.\nDo not state any figure, date, or account position as fact.",
};

export function emptyEvidenceBrief(): EvidenceBrief {
  return EMPTY_BRIEF;
}

export async function buildEvidenceBrief(caseId: string | null | undefined): Promise<EvidenceBrief> {
  if (!caseId) return EMPTY_BRIEF;
  const [periods, facts, events, relationships, unknowns, audit] = await Promise.all([
    db.accountPeriodState.findMany({
      where: { caseId },
      select: { taxPeriod: true, currentBalance: true, currentBalanceAsOf: true },
    }),
    db.evidenceFact.findMany({
      where: { caseId, status: "active" },
      select: { factKey: true, provenance: true, valueText: true, valueNumber: true, taxPeriod: true },
      orderBy: { createdAt: "asc" },
    }),
    db.caseEvent.findMany({
      where: { caseId },
      select: { taxPeriod: true, eventType: true, description: true, eventDate: true, amount: true },
      orderBy: { eventDate: "asc" },
    }),
    db.evidenceRelationship.findMany({
      where: { caseId },
      select: { relationshipType: true, description: true, status: true },
    }),
    db.caseUnknown.findMany({ where: { caseId }, select: { label: true, status: true, reason: true } }),
    db.evidenceAudit.findFirst({ where: { caseId }, orderBy: { createdAt: "desc" }, select: { reportJson: true } }),
  ]);

  let limitations: string[] = [];
  try {
    const report = JSON.parse(audit?.reportJson || "{}");
    const failures: unknown = report?.processingFailures;
    if (Array.isArray(failures)) limitations = failures.map(String);
  } catch {
    limitations = [];
  }

  return formatEvidenceBrief({ periods, facts, events, relationships, unknowns, limitations });
}

/** The brief for the customer's most recently active open case. */
export async function buildLatestCaseBrief(userId: string | null | undefined): Promise<{ brief: EvidenceBrief; caseId: string | null }> {
  if (!userId) return { brief: EMPTY_BRIEF, caseId: null };
  const latest = await db.case.findFirst({
    where: { userId, status: { not: "closed" } },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!latest) return { brief: EMPTY_BRIEF, caseId: null };
  return { brief: await buildEvidenceBrief(latest.id), caseId: latest.id };
}
