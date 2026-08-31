"use server";

import { revalidatePath } from "next/cache";
import { requireAdminArea } from "@/lib/auth";
import {
  parsePromotionLevel,
  setPatternPromotionLevel,
  PROMOTION_LABELS,
} from "@/lib/experience/registry";
import {
  clearPatternStale,
  invalidatePatternsForAuthorityKey,
  markPatternStale,
  recordPatternFeedback,
} from "@/lib/experience/telemetry";
import type { ActionState } from "@/actions/auth";

export async function promoteExperiencePatternAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");
  const id = String(formData.get("observationId") ?? "").trim();
  if (!id) return { error: "Missing pattern id." };
  try {
    const toLevel = parsePromotionLevel(formData.get("toLevel"));
    const result = await setPatternPromotionLevel({ id, toLevel });
    revalidatePath("/admin/experience");
    return {
      ok: true,
      info: `Moved ${result.fromLevel} → ${result.toLevel} (${PROMOTION_LABELS[result.toLevel]}).`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Promotion failed.",
    };
  }
}

export async function recordExperiencePatternFeedbackAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");
  const observationId = String(
    formData.get("observationId") ?? "",
  ).trim();
  const verdict = String(formData.get("verdict") ?? "").trim();
  if (!observationId) return { error: "Missing pattern id." };
  if (verdict !== "help" && verdict !== "harm") {
    return { error: "verdict must be help or harm." };
  }
  try {
    const result = await recordPatternFeedback({
      observationId,
      verdict,
      reasonKey:
        String(formData.get("reason_key") ?? "").trim() || undefined,
    });
    revalidatePath("/admin/experience");
    return {
      ok: true,
      info: `Recorded ${verdict} (help=${result.helpCount}, harm=${result.harmCount}).${result.staleAt ? " Pattern auto-staled." : ""}`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Feedback failed.",
    };
  }
}

export async function markExperiencePatternStaleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");
  const observationId = String(
    formData.get("observationId") ?? "",
  ).trim();
  if (!observationId) return { error: "Missing pattern id." };
  try {
    await markPatternStale({
      observationId,
      reasonKey: String(
        formData.get("reason_key") ?? "admin_marked_stale",
      ),
    });
    revalidatePath("/admin/experience");
    return { ok: true, info: "Pattern marked stale." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not mark stale.",
    };
  }
}

export async function clearExperiencePatternStaleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");
  const observationId = String(
    formData.get("observationId") ?? "",
  ).trim();
  if (!observationId) return { error: "Missing pattern id." };
  try {
    await clearPatternStale({ observationId });
    revalidatePath("/admin/experience");
    return { ok: true, info: "Stale status cleared." };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not clear stale.",
    };
  }
}

export async function invalidateExperiencePatternsForAuthorityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdminArea("admin.experience");
  const authorityKey = String(
    formData.get("authority_key") ?? "",
  ).trim();
  if (!authorityKey) return { error: "Missing authority_key." };
  try {
    const result = await invalidatePatternsForAuthorityKey({
      authorityKey,
      reasonKey: "authority_source_changed",
    });
    revalidatePath("/admin/experience");
    return {
      ok: true,
      info: `Marked ${result.marked} production pattern(s) stale.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Authority invalidation failed.",
    };
  }
}
