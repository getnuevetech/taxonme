import "server-only";
import { db } from "./db";
import {
  reviewAnalysisSatisfied,
  uploadDocumentsSatisfied,
  VERIFIABLE_ACTION_COPY,
} from "./case-progress-core";
import { rankPotentialEvidenceSources } from "./evidence/potential-sources";

// Evidence-based path-step verification. Steps with a recognized action key
// are completed only when the system can actually observe the required
// artifact — never by an unchecked checkbox.

export const VERIFIABLE_ACTIONS: Record<string, string> = { ...VERIFIABLE_ACTION_COPY };

export function isVerifiable(actionKey: string): boolean {
  return actionKey.toUpperCase() in VERIFIABLE_ACTIONS;
}

async function requiredUploadKinds(caseId: string): Promise<string[]> {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: { issues: true, documents: { where: { deletedAt: null } } },
  });
  if (!c) return ["transcript", "notice"];
  const haveKinds = new Set(c.documents.map((d) => d.docKind));
  const ranked = rankPotentialEvidenceSources({
    issueTypes: c.issues.map((i) => i.issueType),
    hasTranscript: false,
    hasNotice: false,
    hasReturn: haveKinds.has("1040"),
    hasIncomeDocs: haveKinds.has("w2") || haveKinds.has("1099"),
    taxYear: c.issues.find((i) => i.taxYear)?.taxYear ?? null,
    amountKnown: c.issues.some(
      (i) => i.expectedCents != null || i.differenceCents != null || i.receivedCents != null,
    ),
    unfiledDominant: c.issues.some((i) => i.issueType === "missing_return"),
    narrativeMentionsNotice: /\b(notice|letter|cp\d+|lt\d+)\b/i.test(`${c.situation}\n${c.goal}`),
  });
  const kinds = ranked.map((r) => r.kind);
  return kinds.length ? kinds : ["transcript", "notice"];
}

async function latestAuditStatus(caseId: string): Promise<string | null> {
  const row = await db.evidenceAudit.findFirst({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  return row?.status ?? null;
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
      const docs = await db.document.findMany({
        where: { caseId: ctx.caseId, deletedAt: null },
        select: { docKind: true, documentType: true },
      });
      const required = await requiredUploadKinds(ctx.caseId);
      return uploadDocumentsSatisfied(docs, required);
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
      const newestDoc = await db.document.findFirst({
        where: { caseId: ctx.caseId, deletedAt: null },
        orderBy: { uploadedAt: "desc" },
      });
      if (!newestDoc) return false;
      const runAfter = await db.analysisRun.count({
        where: { caseId: ctx.caseId, status: "complete", startedAt: { gte: newestDoc.uploadedAt } },
      });
      const auditStatus = await latestAuditStatus(ctx.caseId);
      return reviewAnalysisSatisfied({
        hasRunAfterNewestDoc: runAfter > 0,
        auditStatus,
      });
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
