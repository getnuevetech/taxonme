"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { buildPrepPlanContent, parsePathwaysJson } from "@/lib/prep-plan";
import type { ActionState } from "@/actions/auth";

/**
 * Build a Prep Plan from a Situation. Never creates a Case / never runs V5.1.
 */
export async function createPrepPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const situationId = String(formData.get("situationId") ?? "").trim();
  const selectedPathway = String(formData.get("selectedPathway") ?? "").trim();
  if (!situationId) return { error: "Missing situation." };

  const user = await getCurrentUser();
  const guest = user ? null : await getOrCreateGuestSession();

  if (user) {
    const { getPrepPlanQuota } = await import("@/lib/billing-quotas");
    const quota = await getPrepPlanQuota(user.id);
    if (!quota.hasAccess) {
      return { error: "Prep Plans require Plus or Pro. Upgrade to build a preparation plan from this Situation." };
    }
    if (quota.overLimit) {
      return {
        error: `Plus allows ${quota.limit} Prep Plan${quota.limit === 1 ? "" : "s"} per month. Upgrade to Pro for unlimited plans.`,
      };
    }
  } else if (guest) {
    return { error: "Create a free account, then upgrade to Plus to build a Prep Plan." };
  }

  const situation = await db.situation.findFirst({
    where: user
      ? { id: situationId, userId: user.id }
      : { id: situationId, guestSessionId: guest!.id },
  });
  if (!situation) return { error: "Situation not found." };

  const pathways = parsePathwaysJson(situation.currentPathwaysJson);
  const content = buildPrepPlanContent({
    selectedPathway: selectedPathway || pathways[0]?.id,
    pathways,
    narrative: situation.originalNarrative,
  });

  const plan = await db.prepPlan.create({
    data: {
      situationId: situation.id,
      selectedPathway: content.selectedPathway,
      eligibilityJson: JSON.stringify(content.eligibility),
      blockersJson: JSON.stringify(content.blockers),
      filingsJson: JSON.stringify(content.filings),
      evidenceNeedsJson: JSON.stringify(content.evidenceNeeds),
      sequenceJson: JSON.stringify(content.sequence),
      preparationStatus: content.preparationStatus,
      updatedAt: new Date(),
    },
  });

  await db.situation.update({
    where: { id: situation.id },
    data: { status: "prep_plan", updatedAt: new Date() },
  });

  redirect(user ? `/app/prep-plans/${plan.id}` : `/start/prep-plan?id=${plan.id}`);
}

/** Authenticated helper for tests / programmatic create. */
export async function createPrepPlanForSituation(situationId: string, selectedPathway?: string) {
  const user = await requireUser();
  const { getPrepPlanQuota } = await import("@/lib/billing-quotas");
  const quota = await getPrepPlanQuota(user.id);
  if (!quota.hasAccess) throw new Error("Prep Plans require Plus or Pro.");
  if (quota.overLimit) throw new Error("Monthly Prep Plan limit reached.");
  const situation = await db.situation.findFirst({ where: { id: situationId, userId: user.id } });
  if (!situation) throw new Error("Situation not found");
  const pathways = parsePathwaysJson(situation.currentPathwaysJson);
  const content = buildPrepPlanContent({
    selectedPathway: selectedPathway || pathways[0]?.id,
    pathways,
    narrative: situation.originalNarrative,
  });
  return db.prepPlan.create({
    data: {
      situationId,
      selectedPathway: content.selectedPathway,
      eligibilityJson: JSON.stringify(content.eligibility),
      blockersJson: JSON.stringify(content.blockers),
      filingsJson: JSON.stringify(content.filings),
      evidenceNeedsJson: JSON.stringify(content.evidenceNeeds),
      sequenceJson: JSON.stringify(content.sequence),
      preparationStatus: "draft",
      updatedAt: new Date(),
    },
  });
}
