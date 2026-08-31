"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  CORRECTION_FAILURE_TYPES,
  publishPatternCandidateFromCorrection,
  type ConsultantCorrectionInput,
  type ExperienceRecordV0,
} from "@/lib/experience";
import type { ActionState } from "@/actions/auth";

async function correctionSource(
  situationId: string,
): Promise<ExperienceRecordV0> {
  const user = await requireUser();
  if (user.role !== ROLES.CONSULTANT && !isAdmin(user)) {
    throw new Error("Consultant or admin access required.");
  }
  const row = isAdmin(user)
    ? await db.situation.findUnique({
        where: { id: situationId },
        select: { learningEventJson: true },
      })
    : await db.situation.findFirst({
        where: {
          id: situationId,
          cases: {
            some: {
              assignments: {
                some: {
                  consultantId: user.id,
                  status: { in: ["proposed", "user_accepted", "active"] },
                },
              },
            },
          },
        },
        select: { learningEventJson: true },
      });
  if (!row) throw new Error("Situation not found or not assigned.");
  const record = JSON.parse(row.learningEventJson) as ExperienceRecordV0;
  if (record.schema_version !== "l0") {
    throw new Error("Situation does not contain an experience record.");
  }
  return record;
}

export async function recordConsultantExperienceCorrectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const situationId = String(formData.get("situationId") ?? "").trim();
  if (!situationId) return { error: "Missing situation id." };
  const failure_type = String(
    formData.get("failure_type") ?? "other",
  ) as ConsultantCorrectionInput["failure_type"];
  if (!CORRECTION_FAILURE_TYPES.includes(failure_type)) {
    return { error: "Invalid correction failure type." };
  }
  try {
    const record = await correctionSource(situationId);
    const result = await publishPatternCandidateFromCorrection({
      situationId,
      record,
      correction: {
        failure_type,
        incorrect_key: String(formData.get("incorrect_key") ?? ""),
        preferred_key: String(formData.get("preferred_key") ?? ""),
        note_key: String(formData.get("note_key") ?? ""),
        lesson_id:
          String(formData.get("lesson_id") ?? "").trim() || undefined,
      },
    });
    revalidatePath("/admin/experience");
    return {
      ok: true,
      info: `Created de-identified pattern candidate ${result.id}.`,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Correction failed.",
    };
  }
}
