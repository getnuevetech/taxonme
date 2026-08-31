/**
 * Phase −1.9 L1–L4 — publish de-identified observations and candidates.
 */
import { db } from "@/lib/db";
import type { ExperienceRecordV0 } from "./experience-record";
import {
  assertSafeForSharedExperience,
  deidentifyExperienceRecord,
  type AnonymizedExperienceRecord,
} from "./deidentify";
import {
  applyConsultantCorrection,
  assertIsPatternCandidate,
  buildPatternCandidate,
  type ConsultantCorrectionInput,
} from "./corrections";
import {
  applyGovernmentOutcome,
  assertIsOutcomeCandidate,
  authorityKeysRecognized,
  buildOutcomePatternCandidate,
  checkOutcomeAuthority,
  type GovernmentOutcomeInput,
} from "./outcomes";

export async function publishAnonymizedObservation(opts: {
  record: ExperienceRecordV0;
  situationId: string;
}): Promise<{ id: string; anon: AnonymizedExperienceRecord }> {
  const anon = deidentifyExperienceRecord(opts.record, {
    sourceId: opts.situationId,
  });
  assertSafeForSharedExperience(anon);
  const row = await db.experienceObservation.create({
    data: {
      sourceDigest: anon.source_digest,
      decisionTarget: anon.decision_target,
      workspace: anon.workspace,
      promotionLevel: 0,
      anonJson: JSON.stringify(anon),
      sourceSituationId: opts.situationId,
    },
  });
  return { id: row.id, anon };
}

export async function publishPatternCandidateFromCorrection(opts: {
  record: ExperienceRecordV0;
  correction: ConsultantCorrectionInput;
  situationId?: string | null;
}): Promise<{
  id: string;
  candidate: AnonymizedExperienceRecord;
  corrected: ExperienceRecordV0;
}> {
  const corrected = applyConsultantCorrection(opts.record, opts.correction);
  const candidate = buildPatternCandidate(corrected, {
    sourceId:
      opts.situationId || `correction:${corrected.decision_target}`,
  });
  assertIsPatternCandidate(candidate);
  const row = await db.experienceObservation.create({
    data: {
      sourceDigest: candidate.source_digest,
      decisionTarget: candidate.decision_target,
      workspace: candidate.workspace,
      promotionLevel: 1,
      anonJson: JSON.stringify(candidate),
      sourceSituationId: opts.situationId || null,
    },
  });
  return { id: row.id, candidate, corrected };
}

export async function publishPatternCandidateFromOutcome(opts: {
  record: ExperienceRecordV0;
  outcome: GovernmentOutcomeInput;
  situationId?: string | null;
  authorityCatalogKeys?: string[];
}): Promise<{
  id: string;
  candidate: AnonymizedExperienceRecord;
  updated: ExperienceRecordV0;
}> {
  const gate = checkOutcomeAuthority(opts.outcome);
  if (!gate.ok) throw new Error(`Authority check failed: ${gate.reason}`);
  if (opts.authorityCatalogKeys) {
    const recognized = authorityKeysRecognized(
      opts.outcome.authority_keys,
      opts.authorityCatalogKeys,
    );
    if (!recognized.ok) {
      throw new Error(
        `Unknown authority_keys: ${recognized.missing.join(", ")}`,
      );
    }
  }
  const updated = applyGovernmentOutcome(opts.record, opts.outcome);
  const candidate = buildOutcomePatternCandidate(updated, {
    sourceId:
      opts.situationId ||
      `outcome:${updated.decision_target}:${opts.outcome.outcome_kind}`,
  });
  assertIsOutcomeCandidate(candidate);
  const row = await db.experienceObservation.create({
    data: {
      sourceDigest: candidate.source_digest,
      decisionTarget: candidate.decision_target,
      workspace: candidate.workspace,
      promotionLevel: 1,
      anonJson: JSON.stringify(candidate),
      sourceSituationId: opts.situationId || null,
    },
  });
  return { id: row.id, candidate, updated };
}

export async function listSharedObservations(opts?: {
  decisionTarget?: string;
  minPromotionLevel?: number;
  maxPromotionLevel?: number;
  limit?: number;
  excludeStale?: boolean;
}): Promise<AnonymizedExperienceRecord[]> {
  const min = opts?.minPromotionLevel ?? 0;
  const max = opts?.maxPromotionLevel ?? 0;
  const excludeStale = opts?.excludeStale ?? (min >= 4 && max >= 4);
  const rows = await db.experienceObservation.findMany({
    where: {
      promotionLevel: { gte: min, lte: max },
      ...(opts?.decisionTarget
        ? { decisionTarget: opts.decisionTarget }
        : {}),
      ...(excludeStale ? { staleAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 50,
    select: { anonJson: true },
  });

  const observations: AnonymizedExperienceRecord[] = [];
  for (const row of rows) {
    try {
      const anon = JSON.parse(
        row.anonJson,
      ) as AnonymizedExperienceRecord;
      assertSafeForSharedExperience(anon);
      observations.push(anon);
    } catch {
      // Corrupt or unsafe rows never cross the shared-store boundary.
    }
  }
  return observations;
}

export async function listPatternCandidates(opts?: {
  decisionTarget?: string;
  limit?: number;
}): Promise<AnonymizedExperienceRecord[]> {
  return listSharedObservations({
    decisionTarget: opts?.decisionTarget,
    minPromotionLevel: 1,
    maxPromotionLevel: 1,
    limit: opts?.limit ?? 50,
  });
}

/** Experience Search's only data source: non-stale L4 Production patterns. */
export async function listProductionPatterns(
  limit = 20,
): Promise<AnonymizedExperienceRecord[]> {
  return listSharedObservations({
    minPromotionLevel: 4,
    maxPromotionLevel: 4,
    limit,
    excludeStale: true,
  });
}
