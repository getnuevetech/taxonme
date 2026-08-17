"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { saveUpload, deleteUpload, validateUploadFile } from "@/lib/uploads";
import { explainNoticeContent } from "@/lib/ai/orchestrator";
import { verifyCaseProgress, verifyUserCasesProgress } from "@/lib/case-progress";
import type { ActionState } from "./auth";

export async function uploadDocumentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const docKind = String(formData.get("docKind") ?? "other");
  const submittedCaseId = String(formData.get("caseId") ?? "") || null;
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose at least one file." };

  const guest = user ? null : await getOrCreateGuestSession();
  let caseId: string | null = null;
  if (submittedCaseId) {
    const c = await db.case.findFirst({
      where: user
        ? { id: submittedCaseId, userId: user.id }
        : { id: submittedCaseId, guestSessionId: guest!.id },
      select: { id: true },
    });
    if (!c) return { error: "Case not found." };
    caseId = c.id;
  }

  for (const file of files.slice(0, 10)) {
    const validationError = validateUploadFile(file);
    if (validationError) return { error: validationError };
    const { filePath, sizeBytes } = await saveUpload(file);
    await db.document.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: guest?.id ?? null,
        caseId,
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
        docKind,
      },
    });
  }
  // New evidence changes the picture: re-run the case analysis automatically
  // so issues, amounts, and next steps reflect the uploaded documents. The
  // analysis itself re-verifies path-step evidence when it finishes.
  if (user) {
    if (caseId) {
      const ownedCaseId = caseId;
      // Run the (potentially minutes-long) multi-model re-analysis in the
      // background — the upload returns instantly and the case page
      // live-refreshes while status is "analyzing".
      await db.case.update({ where: { id: ownedCaseId }, data: { status: "analyzing" } });
      after(async () => {
        try {
          const { runCaseAnalysis } = await import("@/lib/ai/orchestrator");
          await runCaseAnalysis(ownedCaseId);
        } catch (err) {
          const { logSystem } = await import("@/lib/syslog");
          await logSystem("error", "analysis", "Background re-analysis after upload failed", String(err));
          await db.case.update({ where: { id: ownedCaseId }, data: { status: "analyzed" } }).catch(() => null);
        }
      });
    } else {
      await verifyUserCasesProgress(user.id);
    }
  }
  revalidatePath("/app/documents");
  if (caseId) revalidatePath(`/app/cases/${caseId}`);
  return { ok: true };
}

export async function deleteDocumentAction(documentId: string) {
  const user = await requireUser();
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.userId !== user.id) return;
  // Delete the DB record first so a failed file deletion leaves no dangling reference.
  await db.document.delete({ where: { id: documentId } });
  await deleteUpload(doc.filePath);
  // Removing evidence can un-complete verified steps.
  if (doc.caseId) await verifyCaseProgress(doc.caseId);
  else await verifyUserCasesProgress(user.id);
  revalidatePath("/app/documents");
}

// Upload an IRS notice (file or photo) and run identification + explanation.
export async function uploadNoticeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const file = formData.get("file");
  const pastedText = String(formData.get("pastedText") ?? "").trim();
  if (!(file instanceof File && file.size > 0) && pastedText.length < 10) {
    return { error: "Upload a file or photo of your notice, or paste its text." };
  }

  const guest = user ? null : await getOrCreateGuestSession();
  let documentId: string | null = null;
  let content = pastedText;

  if (file instanceof File && file.size > 0) {
    const validationError = validateUploadFile(file);
    if (validationError) return { error: validationError };
    const { filePath, sizeBytes } = await saveUpload(file);
    const doc = await db.document.create({
      data: {
        userId: user?.id ?? null,
        guestSessionId: guest?.id ?? null,
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes,
        docKind: "notice",
      },
    });
    documentId = doc.id;
    if (file.type.startsWith("text/") && !content) {
      content = Buffer.from(await file.arrayBuffer()).toString("utf-8").slice(0, 30000);
    }
    if (!content) content = `IRS notice file uploaded: ${file.name}. No machine-readable text available.`;
  }

  const notice = await db.notice.create({
    data: { userId: user?.id ?? null, documentId, status: "analyzing" },
  });

  const result = await explainNoticeContent(content);
  if (result) {
    const noticeIdentity = typeof result.notice_identity === "object" && result.notice_identity !== null
      ? result.notice_identity as Record<string, unknown>
      : {};
    const amounts = Array.isArray(result.amounts) ? result.amounts as Record<string, unknown>[] : [];
    const firstAmount = amounts.find((a) => typeof a.amount === "number" || typeof a.value === "number");
    const amount = typeof result.amount === "number"
      ? result.amount
      : typeof firstAmount?.amount === "number"
        ? firstAmount.amount
        : typeof firstAmount?.value === "number"
          ? firstAmount.value
          : null;
    const deadlineValue = result.deadline ?? (Array.isArray(result.printed_deadlines) ? result.printed_deadlines[0] : null);
    const deadlineStr = typeof deadlineValue === "string" ? deadlineValue : "";
    const deadline = deadlineStr && !Number.isNaN(Date.parse(deadlineStr)) ? new Date(deadlineStr) : null;
    const noticeType = String(result.notice_type ?? noticeIdentity.notice_type ?? "") || "";
    const explanation = String(result.plain_english_explanation ?? result.what_it_means ?? "");
    const nextSteps = result.next_steps ?? result.available_response_categories ?? result.what_irs_wants ?? [];
    await db.notice.update({
      where: { id: notice.id },
      data: {
        noticeType,
        taxYear: typeof result.tax_year === "number"
          ? result.tax_year
          : typeof noticeIdentity.tax_year === "number"
            ? noticeIdentity.tax_year
            : null,
        amountCents: typeof amount === "number" ? Math.round(amount * 100) : null,
        deadline,
        explanation,
        nextStepsJson: JSON.stringify(nextSteps),
        status: result.fallback || result.certainty === "NEEDS_VERIFICATION" ? "verification_required" : "explained",
      },
    });
    if (deadline && user) {
      await db.deadline.create({
        data: {
          userId: user.id,
          title: `Respond to IRS notice ${noticeType}`.trim(),
          dueDate: deadline,
          source: "notice",
        },
      });
    }
  }
  return { ok: true, ...(user ? {} : {}), error: undefined };
}
