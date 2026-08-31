/**
 * Wave 5 / Phase S4 — apply legacy Case → Situation reclassification (preserves audit IDs).
 */
import { db } from "@/lib/db";
import { composeAssistantReply, runConversationIntelligence } from "@/lib/conversation";
import {
  decideLegacyCaseDisposition,
  primaryGovernmentSystem,
  type LegacyCaseLike,
} from "@/lib/situation-reclassify";
import { situationTitleFromNarrative } from "@/lib/situation";

export type ReclassifyApplyResult = {
  scanned: number;
  kept: number;
  reclassified: number;
  decisions: ReturnType<typeof decideLegacyCaseDisposition>[];
};

export async function scanLegacyCasesForReclassify(limit = 500): Promise<ReclassifyApplyResult> {
  const rows = await db.case.findMany({
    where: { situationId: null },
    take: limit,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      number: true,
      title: true,
      situation: true,
      goal: true,
      userId: true,
      guestSessionId: true,
      notices: { select: { noticeType: true } },
      documents: { select: { fileName: true }, take: 10 },
    },
  });

  const decisions = rows.map((row) =>
    decideLegacyCaseDisposition({
      ...row,
      documentHints: row.documents.map((d) => d.fileName),
    }),
  );

  return {
    scanned: rows.length,
    kept: decisions.filter((d) => d.action === "keep_case").length,
    reclassified: decisions.filter((d) => d.action === "reclassify_to_situation").length,
    decisions,
  };
}

/**
 * Reclassify situation-only Cases into Situation rows.
 * Kept Cases get governmentSystem stamped when missing.
 */
export async function applyLegacyCaseReclassification(opts?: {
  limit?: number;
  dryRun?: boolean;
}): Promise<ReclassifyApplyResult> {
  const dryRun = opts?.dryRun ?? true;
  const limit = opts?.limit ?? 500;

  const rows = await db.case.findMany({
    where: { situationId: null },
    take: limit,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      number: true,
      title: true,
      situation: true,
      goal: true,
      userId: true,
      guestSessionId: true,
      governmentSystem: true,
      notices: { select: { noticeType: true } },
      documents: { select: { fileName: true, id: true }, take: 10 },
    },
  });

  const decisions = [];
  let kept = 0;
  let reclassified = 0;

  for (const row of rows) {
    const decision = decideLegacyCaseDisposition({
      ...row,
      documentHints: row.documents.map((d) => d.fileName),
    } as LegacyCaseLike);
    decisions.push(decision);

    if (decision.action === "keep_case") {
      kept += 1;
      if (!dryRun && !row.governmentSystem) {
        await db.case.update({
          where: { id: row.id },
          data: {
            governmentSystem: primaryGovernmentSystem(decision.governmentSystems) || "irs",
          },
        });
      }
      continue;
    }

    reclassified += 1;
    if (dryRun) continue;

    const intel = runConversationIntelligence({
      message: row.situation,
      goal: row.goal,
    });
    const assistantReply = composeAssistantReply(intel, row.situation);

    const situation = await db.situation.create({
      data: {
        userId: row.userId,
        guestSessionId: row.guestSessionId,
        title: situationTitleFromNarrative(row.situation, intel.question_contract.explicit_question),
        originalNarrative: row.situation,
        goal: row.goal,
        questionContractJson: JSON.stringify(intel.question_contract),
        currentDecisionTarget: intel.question_contract.decision_target,
        currentPathwaysJson: JSON.stringify(
          intel.strategy.branches.map((b) => ({
            id: b.id,
            condition: b.condition,
            explanation: b.explanation,
          })),
        ),
        status: "guiding",
        intelligenceJson: JSON.stringify(intel),
        learningEventJson: JSON.stringify(intel.learning_event),
        assistantReply,
        legacyCaseId: row.id,
        legacyRecordType: "reclassified_to_situation",
        migrationTimestamp: new Date(),
        updatedAt: new Date(),
      },
    });

    await db.document.updateMany({
      where: { caseId: row.id },
      data: { situationId: situation.id },
    });

    await db.case.update({
      where: { id: row.id },
      data: {
        situationId: situation.id,
        status: "closed",
        closedAt: new Date(),
        closedReason: "reclassified_to_situation",
        closingRemarks: `Reclassified to Situation ${situation.id}; legacy Case retained for audit.`,
      },
    });
  }

  return { scanned: rows.length, kept, reclassified, decisions };
}
