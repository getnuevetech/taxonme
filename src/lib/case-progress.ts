import "server-only";
import { db } from "./db";

// Evidence-based path-step verification. Steps with a recognized action key
// are completed only when the system can actually observe the required
// artifact — never by an unchecked checkbox.

export const VERIFIABLE_ACTIONS: Record<string, string> = {
  UPLOAD_DOCUMENTS: "Completes when your case has at least one document",
  GET_TRANSCRIPT: "Completes when an IRS transcript is uploaded to your case",
  GET_ACCOUNT_TRANSCRIPT: "Completes when an IRS transcript is uploaded to your case",
  REVIEW_ANALYSIS: "Completes when the analysis has been re-run after documents were added",
  RERUN_ANALYSIS: "Completes when the analysis has been re-run after documents were added",
  DRAFT_LETTER: "Completes when a response letter has been drafted",
  COMPLETE_FORM_9465: "Completes when the Form 9465 wizard is finished",
  ADD_DEADLINE: "Completes when a deadline is tracked for this case",
};

export function isVerifiable(actionKey: string): boolean {
  return actionKey.toUpperCase() in VERIFIABLE_ACTIONS;
}

async function stepSatisfied(
  actionKey: string,
  ctx: {
    caseId: string;
    userId: string | null;
    caseCreatedAt: Date;
  },
): Promise<boolean> {
  const key = actionKey.toUpperCase();
  switch (key) {
    case "UPLOAD_DOCUMENTS": {
      const count = await db.document.count({
        where: { caseId: ctx.caseId, deletedAt: null, docKind: { not: "avatar" } },
      });
      return count > 0;
    }
    case "GET_TRANSCRIPT":
    case "GET_ACCOUNT_TRANSCRIPT": {
      const where = ctx.userId
        ? { userId: ctx.userId, deletedAt: null, docKind: "transcript" }
        : { caseId: ctx.caseId, deletedAt: null, docKind: "transcript" };
      return (await db.document.count({ where })) > 0;
    }
    case "REVIEW_ANALYSIS":
    case "RERUN_ANALYSIS": {
      // Satisfied when a completed analysis run started after the newest document upload.
      const newestDoc = await db.document.findFirst({
        where: { caseId: ctx.caseId, deletedAt: null },
        orderBy: { uploadedAt: "desc" },
      });
      if (!newestDoc) return false;
      const runAfter = await db.analysisRun.count({
        where: { caseId: ctx.caseId, status: "complete", startedAt: { gte: newestDoc.uploadedAt } },
      });
      return runAfter > 0;
    }
    case "DRAFT_LETTER": {
      if (!ctx.userId) return false;
      const count = await db.responseLetter.count({
        where: {
          userId: ctx.userId,
          OR: [{ caseId: ctx.caseId }, { createdAt: { gte: ctx.caseCreatedAt } }],
        },
      });
      return count > 0;
    }
    case "COMPLETE_FORM_9465": {
      if (!ctx.userId) return false;
      const count = await db.formSubmission.count({
        where: { userId: ctx.userId, status: "completed", template: { formNumber: "9465" } },
      });
      return count > 0;
    }
    case "ADD_DEADLINE": {
      if (!ctx.userId) return false;
      const count = await db.deadline.count({
        where: { userId: ctx.userId, OR: [{ caseId: ctx.caseId }, { createdAt: { gte: ctx.caseCreatedAt } }] },
      });
      return count > 0;
    }
    default:
      return false;
  }
}

/**
 * Re-evaluate every path step of a case against real evidence.
 * - Verifiable steps flip to done/pending based on what actually exists.
 * - Manual steps (no recognized action key) are left as the user set them.
 * - The first not-done step becomes "current".
 * Returns the number of steps that changed.
 */
export async function verifyCaseProgress(caseId: string): Promise<number> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { pathSteps: { orderBy: { sortOrder: "asc" } } },
  });
  if (!c || c.pathSteps.length === 0) return 0;

  let changed = 0;
  const ctx = { caseId, userId: c.userId, caseCreatedAt: c.createdAt };

  for (const step of c.pathSteps) {
    if (!isVerifiable(step.actionKey)) continue;
    const satisfied = await stepSatisfied(step.actionKey, ctx);
    const desired = satisfied ? "done" : "pending";
    if ((step.status === "done") !== satisfied) {
      await db.pathStep.update({ where: { id: step.id }, data: { status: desired } });
      changed++;
    }
  }

  // Recompute which step is "current": the first one not done.
  const steps = await db.pathStep.findMany({ where: { caseId }, orderBy: { sortOrder: "asc" } });
  let currentAssigned = false;
  for (const step of steps) {
    let desired = step.status;
    if (step.status !== "done") {
      desired = !currentAssigned ? "current" : "pending";
      currentAssigned = true;
    }
    if (desired !== step.status) {
      await db.pathStep.update({ where: { id: step.id }, data: { status: desired } });
    }
  }
  return changed;
}

/** Verify progress across all of a user's open cases (cheap; used after cross-case actions like finishing a form). */
export async function verifyUserCasesProgress(userId: string): Promise<void> {
  const cases = await db.case.findMany({
    where: { userId, status: { notIn: ["resolved"] } },
    select: { id: true },
  });
  for (const c of cases) await verifyCaseProgress(c.id);
}
