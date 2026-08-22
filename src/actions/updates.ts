"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { analyzeUpdateImpactForCase, userCanSeeCaseImpact } from "@/lib/agency-updates/impact";
import type { ActionState } from "./auth";

export async function analyzeUpdateImpactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await userCanSeeCaseImpact(user.id))) {
    return { error: "Personalized update analysis is included with Plus and Pro." };
  }
  const updateId = String(formData.get("updateId") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  if (!updateId || !caseId) return { error: "Missing update or case." };
  const result = await analyzeUpdateImpactForCase({ userId: user.id, caseId, updateId, force: true });
  if (!result) return { error: "Could not analyze this update for that case." };
  revalidatePath(`/updates`);
  revalidatePath(`/app/updates`);
  return { ok: true };
}
