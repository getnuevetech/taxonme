"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isAdmin, requireUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  GOVERNMENT_SYSTEMS,
  OUTCOME_KINDS,
  publishPatternCandidateFromOutcome,
  type ExperienceRecordV0,
  type GovernmentOutcomeInput,
} from "@/lib/experience";
import type { ActionState } from "@/actions/auth";

async function outcomeSource(
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

function institutionalKeys(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean);
}

export async function recordGovernmentOutcomeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const situationId = String(formData.get("situationId") ?? "").trim();
  if (!situationId) return { error: "Missing situation id." };
  const outcome_kind = String(
    formData.get("outcome_kind") ?? "",
  ) as GovernmentOutcomeInput["outcome_kind"];
  const government_system = String(
    formData.get("government_system") ?? "",
  ) as GovernmentOutcomeInput["government_system"];
  if (!OUTCOME_KINDS.includes(outcome_kind)) {
    return { error: "Invalid tax outcome kind." };
  }
  if (!GOVERNMENT_SYSTEMS.includes(government_system)) {
    return { error: "Invalid tax government system." };
  }

  try {
    const record = await outcomeSource(situationId);
    const result = await publishPatternCandidateFromOutcome({
      situationId,
      record,
      outcome: {
        outcome_kind,
        government_system,
        form_or_notice_key: String(
          formData.get("form_or_notice_key") ?? "",
        ),
        decision_changing_facts: institutionalKeys(
          formData.get("decision_changing_facts"),
        ),
        authority_keys: institutionalKeys(
          formData.get("authority_keys"),
        ),
        authority_publisher: String(
          formData.get("authority_publisher") ?? "",
        ),
        note_key: String(formData.get("note_key") ?? ""),
      },
    });
    revalidatePath("/admin/experience");
    return {
      ok: true,
      info: `Created authority-checked historical experience candidate ${result.id}.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Outcome failed.",
    };
  }
}
