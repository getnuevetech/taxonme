"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { saveUpload } from "@/lib/uploads";
import { situationTitleFromNarrative } from "@/lib/situation";
import type { ConversationIntelligence } from "@/lib/conversation";
import type { ActionState } from "@/actions/auth";

/**
 * Persist a Situation workspace (Wave 5 / Phase S Option B).
 * Never runs V5.1 Case analysis. Experience publish deferred to Wave 7.
 */
export async function createSituationFromIntelligence(opts: {
  situation: string;
  goal: string;
  intel: ConversationIntelligence;
  assistantReply: string;
  files?: File[];
}): Promise<{ id: string; userId: string | null }> {
  const user = await getCurrentUser();
  const guest = user ? null : await getOrCreateGuestSession();
  const files = opts.files ?? [];

  const row = await db.situation.create({
    data: {
      userId: user?.id ?? null,
      guestSessionId: user ? null : guest!.id,
      title: situationTitleFromNarrative(
        opts.situation,
        opts.intel.question_contract.explicit_question,
      ),
      originalNarrative: opts.situation,
      goal: opts.goal,
      questionContractJson: JSON.stringify(opts.intel.question_contract),
      currentDecisionTarget: opts.intel.question_contract.decision_target,
      knownFactsJson: "[]",
      currentPathwaysJson: JSON.stringify(
        opts.intel.strategy.branches.map((b) => ({
          id: b.id,
          condition: b.condition,
          explanation: b.explanation,
        })),
      ),
      currentRisksJson: "[]",
      status: "guiding",
      intelligenceJson: JSON.stringify(opts.intel),
      learningEventJson: JSON.stringify(opts.intel.experience_record ?? opts.intel.learning_event),
      assistantReply: opts.assistantReply,
      updatedAt: new Date(),
    },
  });

  for (const file of files.slice(0, 10)) {
    const { filePath, sizeBytes, contentHash } = await saveUpload(file);
    await db.document.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: user ? null : guest!.id,
        situationId: row.id,
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
        contentHash,
        docKind: "other",
      },
    });
  }

  // Wave 7 will publish anonymized experience observations; persist only for now.
  after(() => recordSituationLearningEvent(row.id));

  return { id: row.id, userId: user?.id ?? null };
}

export async function redirectToSituation(id: string, userId: string | null) {
  redirect(userId ? `/app/situations/${id}` : `/start/situation?id=${id}`);
}

/** No-op placeholder so after() callers have a typed import path for future enrichment. */
export async function recordSituationLearningEvent(situationId: string) {
  after(async () => {
    try {
      const row = await db.situation.findUnique({
        where: { id: situationId },
        select: { learningEventJson: true },
      });
      if (!row?.learningEventJson) return;
      // Wave 7 will consume learningEventJson into Experience Memory.
    } catch {
      /* ignore */
    }
  });
}

export type { ActionState };
