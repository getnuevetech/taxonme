"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, requireAdminArea } from "@/lib/auth";
import { guideRespond, type GuideReply } from "@/lib/guide";
import type { ActionState } from "./auth";

// ---------- Guide chatbot ----------

export async function askGuideAction(history: { role: string; content: string }[]): Promise<GuideReply> {
  const user = await requireUser();
  // Persist the exchange for continuity (guide threads are separate from Q&A).
  const reply = await guideRespond(user.id, history.slice(-12));
  const last = [...history].reverse().find((m) => m.role === "user");
  if (last) {
    let thread = await db.qaThread.findFirst({ where: { userId: user.id, kind: "guide" } });
    if (!thread) {
      thread = await db.qaThread.create({ data: { userId: user.id, kind: "guide", title: "Case guide" } });
    }
    await db.qaMessage.createMany({
      data: [
        { threadId: thread.id, role: "user", content: last.content },
        { threadId: thread.id, role: "assistant", content: reply.message },
      ],
    });
  }
  return reply;
}

// ---------- Tickets (user side) ----------

export async function createTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "customer_service");
  const source = String(formData.get("source") ?? "manual");
  if (!subject) return { error: "Give your ticket a short subject." };
  if (body.length < 10) return { error: "Describe the issue in a sentence or two." };

  const ticket = await db.ticket.create({
    data: {
      userId: user.id,
      subject: subject.slice(0, 150),
      category: category === "tech_support" ? "tech_support" : "customer_service",
      source: source === "chatbot" ? "chatbot" : "manual",
      messages: { create: { authorId: user.id, fromStaff: false, body } },
    },
  });

  const admins = await db.user.findMany({ where: { role: { in: ["super_admin", "admin"] }, status: "active" } });
  for (const admin of admins) {
    await db.notification.create({
      data: {
        userId: admin.id,
        kind: "info",
        title: `New ${ticket.category === "tech_support" ? "tech support" : "customer service"} ticket`,
        body: `${user.email}: ${subject.slice(0, 80)}`,
        link: `/admin/tickets/${ticket.id}`,
      },
    });
  }
  redirect(`/app/support/${ticket.id}?created=1`);
}

export async function replyTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Type a message first." };
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.userId !== user.id) return { error: "Ticket not found." };
  await db.ticketMessage.create({ data: { ticketId, authorId: user.id, fromStaff: false, body } });
  await db.ticket.update({
    where: { id: ticketId },
    data: { status: ticket.status === "resolved" || ticket.status === "closed" ? "open" : ticket.status },
  });
  revalidatePath(`/app/support/${ticketId}`);
  return { ok: true };
}

export async function closeOwnTicketAction(ticketId: string) {
  const user = await requireUser();
  await db.ticket.updateMany({ where: { id: ticketId, userId: user.id }, data: { status: "closed" } });
  revalidatePath(`/app/support/${ticketId}`);
  revalidatePath("/app/support");
}

// ---------- Tickets (admin side) ----------

// Admin creates a ticket on behalf of a customer or consultant and can assign
// it to an agent (any admin user) immediately.
export async function adminCreateTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdminArea("admin.tickets");
  const userId = String(formData.get("userId") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const category = String(formData.get("category") ?? "customer_service");
  const priority = String(formData.get("priority") ?? "normal");
  const assignedToId = String(formData.get("assignedToId") ?? "") || null;

  if (!userId) return { error: "Choose the customer or consultant this ticket is for." };
  if (!subject) return { error: "Subject is required." };
  if (body.length < 5) return { error: "Describe the issue." };
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || (target.role !== "user" && target.role !== "consultant")) {
    return { error: "Tickets can only be created for customers and consultants." };
  }
  if (assignedToId) {
    const agent = await db.user.findUnique({ where: { id: assignedToId } });
    if (!agent || (agent.role !== "admin" && agent.role !== "super_admin")) {
      return { error: "The assigned agent must be an admin user." };
    }
  }

  const ticket = await db.ticket.create({
    data: {
      userId,
      subject: subject.slice(0, 150),
      category: category === "tech_support" ? "tech_support" : "customer_service",
      priority: ["low", "normal", "high", "urgent"].includes(priority) ? priority : "normal",
      source: "admin",
      assignedToId,
      status: assignedToId ? "in_progress" : "open",
      messages: {
        create: {
          authorId: admin.id,
          fromStaff: true,
          body: `(Opened by ${admin.firstName || "our team"} on behalf of ${target.firstName || target.email})\n\n${body}`,
        },
      },
    },
  });

  await db.notification.create({
    data: {
      userId,
      kind: "info",
      title: "A support ticket was opened for you",
      body: subject.slice(0, 100),
      link: `/app/support/${ticket.id}`,
    },
  });
  if (assignedToId && assignedToId !== admin.id) {
    await db.notification.create({
      data: {
        userId: assignedToId,
        kind: "info",
        title: "A ticket was assigned to you",
        body: `${target.email}: ${subject.slice(0, 80)}`,
        link: `/admin/tickets/${ticket.id}`,
      },
    });
  }
  redirect(`/admin/tickets/${ticket.id}?created=1`);
}

// Assign or reassign a ticket to an agent.
export async function assignTicketAgentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdminArea("admin.tickets");
  const ticketId = String(formData.get("ticketId") ?? "");
  const assignedToId = String(formData.get("assignedToId") ?? "") || null;
  if (assignedToId) {
    const agent = await db.user.findUnique({ where: { id: assignedToId } });
    if (!agent || (agent.role !== "admin" && agent.role !== "super_admin")) {
      return { error: "The assigned agent must be an admin user." };
    }
  }
  const ticket = await db.ticket.update({ where: { id: ticketId }, data: { assignedToId } });
  if (assignedToId && assignedToId !== admin.id) {
    await db.notification.create({
      data: {
        userId: assignedToId,
        kind: "info",
        title: "A ticket was assigned to you",
        body: ticket.subject.slice(0, 100),
        link: `/admin/tickets/${ticketId}`,
      },
    });
  }
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
  return { ok: true };
}

export async function adminReplyTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdminArea("admin.tickets");
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Type a reply first." };
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return { error: "Ticket not found." };
  await db.ticketMessage.create({ data: { ticketId, authorId: admin.id, fromStaff: true, body } });
  await db.ticket.update({ where: { id: ticketId }, data: { status: "in_progress" } });
  await db.notification.create({
    data: {
      userId: ticket.userId,
      kind: "info",
      title: "Support replied to your ticket",
      body: ticket.subject,
      link: `/app/support/${ticketId}`,
    },
  });
  revalidatePath(`/admin/tickets/${ticketId}`);
  return { ok: true };
}

export async function setTicketStatusAction(ticketId: string, status: string) {
  await requireAdminArea("admin.tickets");
  if (!["open", "in_progress", "resolved", "closed"].includes(status)) return;
  const ticket = await db.ticket.update({ where: { id: ticketId }, data: { status } });
  if (status === "resolved") {
    await db.notification.create({
      data: {
        userId: ticket.userId,
        kind: "info",
        title: "Your support ticket was resolved",
        body: ticket.subject,
        link: `/app/support/${ticketId}`,
      },
    });
  }
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

// Route a ticket between tech support and customer service.
export async function setTicketCategoryAction(ticketId: string, category: string) {
  await requireAdminArea("admin.tickets");
  if (!["customer_service", "tech_support"].includes(category)) return;
  await db.ticket.update({ where: { id: ticketId }, data: { category } });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}

export async function setTicketPriorityAction(ticketId: string, priority: string) {
  await requireAdminArea("admin.tickets");
  if (!["low", "normal", "high", "urgent"].includes(priority)) return;
  await db.ticket.update({ where: { id: ticketId }, data: { priority } });
  revalidatePath(`/admin/tickets/${ticketId}`);
  revalidatePath("/admin/tickets");
}
