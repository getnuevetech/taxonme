"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getOrCreateGuestSession } from "@/lib/guest";
import { saveUpload, validateImageUploadFile } from "@/lib/uploads";
import { runQaChat, generateLetterDraft } from "@/lib/ai/orchestrator";
import { verifyUserCasesProgress } from "@/lib/case-progress";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import type { ActionState } from "./auth";

// ---------- Profile ----------

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const avatar = formData.get("avatar");
  let avatarPath = user.avatarPath;
  if (avatar instanceof File && avatar.size > 0) {
    const validationError = validateImageUploadFile(avatar);
    if (validationError) return { error: validationError };
    const saved = await saveUpload(avatar);
    avatarPath = saved.filePath;
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      firstName: String(formData.get("firstName") ?? user.firstName),
      lastName: String(formData.get("lastName") ?? user.lastName),
      phone: String(formData.get("phone") ?? user.phone),
      address: String(formData.get("address") ?? user.address),
      idNumber: String(formData.get("idNumber") ?? user.idNumber),
      bio: String(formData.get("bio") ?? user.bio),
      avatarPath,
    },
  });
  revalidatePath("/app/profile");
  return { ok: true };
}

// ---------- Q&A ----------

export async function askQuestionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const question = String(formData.get("question") ?? "").trim();
  if (!question) return { error: "Type a question first." };
  const threadId = String(formData.get("threadId") ?? "");
  const user = await getCurrentUser();

  if (user && !(await hasFeature(user.id, FEATURE_KEYS.QA))) {
    return { error: "AI Q&A is not included in your plan. Upgrade to ask unlimited questions." };
  }

  let thread;
  if (threadId) {
    thread = await db.qaThread.findUnique({ where: { id: threadId }, include: { messages: { orderBy: { createdAt: "asc" } } } });
    if (!thread) return { error: "Conversation not found." };
    if (user ? thread.userId !== user.id : true) {
      const guest = await getOrCreateGuestSession();
      if (thread.guestSessionId !== guest.id) return { error: "Conversation not found." };
    }
  } else {
    const guest = user ? null : await getOrCreateGuestSession();
    thread = await db.qaThread.create({
      data: { userId: user?.id ?? null, guestSessionId: guest?.id ?? null, title: question.slice(0, 60) },
      include: { messages: true },
    });
  }

  await db.qaMessage.create({ data: { threadId: thread.id, role: "user", content: question } });
  const history = [...thread.messages.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: question }];

  // Phase −1: router decides assistant vs case engine before any answer is shown.
  const {
    runConversationIntelligence,
    composeAssistantReply,
    mayPromoteAssistantToCase,
  } = await import("@/lib/conversation");
  const intel = runConversationIntelligence({
    message: question,
    goal: thread.title,
    history,
    documentCount: 0,
  });
  const promo = mayPromoteAssistantToCase({
    contract: intel.question_contract,
    userExplicitlyRequestsCase: false,
    documentCount: 0,
    existingGovernmentCase: intel.route.existing_government_case,
    responseMode: intel.route.response_mode,
  });

  let answer: string;
  if (intel.route.pipeline === "assistant" || !promo.allowed) {
    // Pipeline A: structured deterministic scaffold + model polish when available.
    const scaffold = composeAssistantReply(intel, question);
    const modelAnswer = await runQaChat(history, user?.id);
    answer = modelAnswer?.trim()
      ? `${scaffold}\n\n---\n\n${modelAnswer}`
      : scaffold;
  } else {
    answer = await runQaChat(history, user?.id);
  }

  await db.qaMessage.create({ data: { threadId: thread.id, role: "assistant", content: answer } });

  if (!threadId) redirect(user ? `/app/qa/${thread.id}` : `/start/qa?thread=${thread.id}`);
  revalidatePath(`/app/qa/${thread.id}`);
  return { ok: true };
}

// ---------- Deadlines ----------

export async function addDeadlineAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!title || !dueDate) return { error: "Title and date are required." };
  await db.deadline.create({
    data: {
      userId: user.id,
      title,
      dueDate: new Date(dueDate),
      remindDaysBefore: Number(formData.get("remindDaysBefore") ?? 7) || 7,
    },
  });
  revalidatePath("/app/deadlines");
  return { ok: true };
}

export async function setDeadlineStatusAction(id: string, status: "open" | "done") {
  const user = await requireUser();
  const d = await db.deadline.findUnique({ where: { id } });
  if (!d || d.userId !== user.id) return;
  await db.deadline.update({ where: { id }, data: { status } });
  revalidatePath("/app/deadlines");
}

// ---------- Response letters ----------

export async function generateLetterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await hasFeature(user.id, FEATURE_KEYS.LETTERS))) {
    return { error: "Response letters are not included in your plan. Upgrade to generate letters." };
  }
  const context = String(formData.get("context") ?? "").trim();
  const noticeId = String(formData.get("noticeId") ?? "") || null;
  if (context.length < 20) return { error: "Describe what the letter should address (a few sentences)." };

  let noticeContext = "";
  let safeNoticeId: string | null = null;
  let caseId: string | null = null;
  if (noticeId) {
    const notice = await db.notice.findUnique({ where: { id: noticeId }, include: { document: { select: { caseId: true } } } });
    if (notice && notice.userId === user.id) {
      safeNoticeId = notice.id;
      caseId = notice.document?.caseId ?? null;
      noticeContext = `Notice type: ${notice.noticeType}. Tax year: ${notice.taxYear ?? "unknown"}. Explanation: ${notice.explanation}`;
    }
  }
  // The letter is grounded in a specific case's evidence. With several open
  // cases we cannot tell which one this letter is about, so we ground it in
  // none rather than the wrong one.
  if (!caseId) {
    const openCases = await db.case.findMany({ where: { userId: user.id, status: { not: "closed" } }, select: { id: true }, take: 2 });
    if (openCases.length === 1) caseId = openCases[0].id;
  }
  const body = await generateLetterDraft([noticeContext, context].filter(Boolean).join("\n\n"), caseId ?? undefined);
  const letter = await db.responseLetter.create({
    data: { userId: user.id, noticeId: safeNoticeId, title: `Response letter — ${new Date().toLocaleDateString("en-US")}`, body },
  });
  await verifyUserCasesProgress(user.id);
  redirect(`/app/letters/${letter.id}`);
}

export async function updateLetterAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const letter = await db.responseLetter.findUnique({ where: { id } });
  if (!letter || letter.userId !== user.id) return { error: "Letter not found." };
  await db.responseLetter.update({
    where: { id },
    data: {
      title: String(formData.get("title") ?? letter.title),
      body: String(formData.get("body") ?? letter.body),
      status: String(formData.get("status") ?? letter.status),
    },
  });
  revalidatePath(`/app/letters/${id}`);
  return { ok: true };
}

// ---------- Consultant assignment consent ----------

export async function respondToAssignmentAction(assignmentId: string, accept: boolean) {
  const user = await requireUser();
  const a = await db.consultantAssignment.findUnique({ where: { id: assignmentId } });
  if (!a || a.userId !== user.id || a.status !== "proposed") return;
  if (!accept) {
    await db.consultantAssignment.update({ where: { id: assignmentId }, data: { status: "declined" } });
  } else {
    // User consent recorded; becomes active once the consultant also agrees.
    await db.consultantAssignment.update({
      where: { id: assignmentId },
      data: { status: a.consultantAgreedAt ? "active" : "user_accepted", userAgreedAt: new Date() },
    });
    await db.notification.create({
      data: {
        userId: a.consultantId,
        kind: "assignment",
        title: "A client accepted your assignment",
        body: "Review and accept the connection agreement to begin.",
        link: "/consultant",
      },
    });
  }
  revalidatePath("/app/consultants");
}

// ---------- Notifications ----------

export async function markNotificationReadAction(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { readAt: new Date() } });
  revalidatePath("/app");
}
