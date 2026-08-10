"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { runCaseAnalysis } from "@/lib/ai/orchestrator";
import { saveUpload } from "@/lib/uploads";
import type { ActionState } from "./auth";

// Guest-friendly intake: situation + goal + documents, no account required.
export async function startIntakeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const situation = String(formData.get("situation") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  if (situation.length < 20) return { error: "Tell us a bit more about what happened (at least a few sentences)." };
  if (goal.length < 5) return { error: "Tell us what you'd like to achieve." };

  const user = await getCurrentUser();
  let caseId: string;
  if (user) {
    const c = await db.case.create({
      data: { userId: user.id, title: situation.slice(0, 80), situation, goal },
    });
    caseId = c.id;
  } else {
    const guest = await getOrCreateGuestSession();
    await db.guestSession.update({ where: { id: guest.id }, data: { situation, goal } });
    const c = await db.case.create({
      data: { guestSessionId: guest.id, title: situation.slice(0, 80), situation, goal },
    });
    caseId = c.id;
  }

  // Attach uploaded documents.
  const files = formData.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files.slice(0, 10)) {
    const { filePath, sizeBytes } = await saveUpload(file);
    await db.document.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: user ? null : (await getOrCreateGuestSession()).id,
        caseId,
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
      },
    });
  }

  await runCaseAnalysis(caseId);
  redirect(user ? `/app/cases/${caseId}` : `/start/result?case=${caseId}`);
}

export async function createCaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const situation = String(formData.get("situation") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  if (situation.length < 20) return { error: "Describe your situation in a few sentences." };
  const c = await db.case.create({
    data: { userId: user.id, title: situation.slice(0, 80), situation, goal },
  });
  await runCaseAnalysis(c.id);
  redirect(`/app/cases/${c.id}`);
}

export async function reanalyzeCaseAction(caseId: string) {
  const user = await requireUser();
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || c.userId !== user.id) return;
  await runCaseAnalysis(caseId);
  revalidatePath(`/app/cases/${caseId}`);
}

export async function completePathStepAction(stepId: string) {
  const user = await requireUser();
  const step = await db.pathStep.findUnique({ where: { id: stepId }, include: { case: true } });
  if (!step || step.case.userId !== user.id) return;
  await db.pathStep.update({ where: { id: stepId }, data: { status: "done" } });
  const next = await db.pathStep.findFirst({
    where: { caseId: step.caseId, status: "pending" },
    orderBy: { sortOrder: "asc" },
  });
  if (next) await db.pathStep.update({ where: { id: next.id }, data: { status: "current" } });
  revalidatePath(`/app/cases/${step.caseId}`);
}
