"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { runCaseAnalysis } from "@/lib/ai/orchestrator";
import { verifyCaseProgress, isVerifiable } from "@/lib/case-progress";
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

  await db.case.update({ where: { id: caseId }, data: { status: "analyzing" } });
  after(() => runCaseAnalysis(caseId).catch(async (err) => {
    const { logSystem } = await import("@/lib/syslog");
    await logSystem("error", "analysis", "Background intake analysis failed", String(err));
  }));
  redirect(user ? `/app/cases/${caseId}` : `/start/result?case=${caseId}`);
}

export async function createCaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const situation = String(formData.get("situation") ?? "").trim();
  const goal = String(formData.get("goal") ?? "").trim();
  if (situation.length < 20) return { error: "Describe your situation in a few sentences." };
  const c = await db.case.create({
    data: { userId: user.id, title: situation.slice(0, 80), situation, goal, status: "analyzing" },
  });
  after(() => runCaseAnalysis(c.id).catch(async (err) => {
    const { logSystem } = await import("@/lib/syslog");
    await logSystem("error", "analysis", "Background case analysis failed", String(err));
  }));
  redirect(`/app/cases/${c.id}`);
}

export async function reanalyzeCaseAction(caseId: string) {
  const user = await requireUser();
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || c.userId !== user.id) return;
  await db.case.update({ where: { id: caseId }, data: { status: "analyzing" } });
  after(async () => {
    try {
      await runCaseAnalysis(caseId);
    } catch (err) {
      const { logSystem } = await import("@/lib/syslog");
      await logSystem("error", "analysis", "Background re-analysis failed", String(err));
      await db.case.update({ where: { id: caseId }, data: { status: "analyzed" } }).catch(() => null);
    }
  });
  revalidatePath(`/app/cases/${caseId}`);
}

// Clarifying interview: store the Q&A, fold the answer into the case
// narrative in extraction-friendly phrasing, and re-run the analysis so the
// customer immediately sees sharper findings.
export async function clarifyAnswerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const caseId = String(formData.get("caseId") ?? "");
  const answer = String(formData.get("answer") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || c.userId !== user.id) return { error: "Case not found." };
  if (!answer && files.length === 0) return { error: "Type an answer (or attach a file) first." };
  for (const f of files) {
    if (f.size > 20 * 1024 * 1024) return { error: `${f.name} is larger than 20 MB.` };
  }

  const { nextClarifyQuestion, situationLine } = await import("@/lib/clarify");
  const q = await nextClarifyQuestion(caseId);
  if (!q) return { error: "All questions are already answered — the analysis is up to date." };

  // Attached files go straight into the customer's vault as case documents,
  // where the re-analysis below picks them up as evidence.
  const attachedNames: string[] = [];
  for (const file of files.slice(0, 10)) {
    const { filePath, sizeBytes } = await saveUpload(file);
    await db.document.create({
      data: {
        userId: user.id,
        caseId,
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
        docKind: "other",
      },
    });
    attachedNames.push(file.name);
  }
  const answerWithFiles = [answer, attachedNames.length ? `(attached: ${attachedNames.join(", ")})` : ""]
    .filter(Boolean)
    .join(" ");

  await db.caseClarifyMessage.create({
    data: { caseId, role: "assistant", questionKey: q.key, content: q.text },
  });
  await db.caseClarifyMessage.create({
    data: { caseId, role: "user", questionKey: q.key, content: answerWithFiles.slice(0, 2000) },
  });
  await db.case.update({
    where: { id: caseId },
    data: {
      situation: `${c.situation}\n\n${situationLine(q.key, q.text, answerWithFiles)}`,
      status: "analyzing",
    },
  });
  // The multi-model re-analysis can take minutes — never block the button on
  // it. The answer is saved instantly; the analysis runs after the response
  // and the case page live-refreshes while status is "analyzing".
  after(async () => {
    try {
      await runCaseAnalysis(caseId);
    } catch (err) {
      const { logSystem } = await import("@/lib/syslog");
      await logSystem("error", "analysis", "Background re-analysis after a clarify answer failed", String(err));
      await db.case.update({ where: { id: caseId }, data: { status: "analyzed" } }).catch(() => null);
    }
  });
  revalidatePath(`/app/cases/${caseId}`);
  return { ok: true };
}

export async function completePathStepAction(stepId: string) {
  const user = await requireUser();
  const step = await db.pathStep.findUnique({ where: { id: stepId }, include: { case: true } });
  if (!step || step.case.userId !== user.id) return;
  // Verifiable steps can never be checked off blindly — they complete only
  // when the evidence exists, which the verifier below re-checks.
  if (!isVerifiable(step.actionKey)) {
    await db.pathStep.update({ where: { id: stepId }, data: { status: "done" } });
  }
  await verifyCaseProgress(step.caseId);
  revalidatePath(`/app/cases/${step.caseId}`);
}

// "Check my progress" — re-evaluates every step against real evidence.
export async function checkCaseProgressAction(caseId: string) {
  const user = await requireUser();
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c || c.userId !== user.id) return;
  await verifyCaseProgress(caseId);
  revalidatePath(`/app/cases/${caseId}`);
}
