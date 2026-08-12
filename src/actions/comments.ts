"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, hasAdminArea } from "@/lib/auth";
import { getBoolSetting } from "@/lib/settings";
import type { ActionState } from "./auth";

// Case discussion with visibility rules:
// - Customers may mark a comment PRIVATE (hidden from consultant AND admin) — if enabled.
// - Consultants may hide a comment from the customer — but never from admins.
// - Admins may hide a comment from the customer (visible to consultants).
// Which checkboxes are available is controlled by admin settings (group "comments").
export async function addCaseCommentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const caseId = String(formData.get("caseId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const hide = formData.get("hide") === "on";
  if (!body) return { error: "Write a comment first." };
  if (body.length > 4000) return { error: "Comments are limited to 4000 characters." };

  const c = await db.case.findUnique({ where: { id: caseId }, select: { id: true, userId: true, title: true, number: true } });
  if (!c) return { error: "Case not found." };

  // Determine the viewer's relationship to this case.
  let authorRole: "customer" | "consultant" | "admin";
  if (user.role === "super_admin" || user.role === "admin") {
    if (!hasAdminArea(user, "admin.cases")) return { error: "You don't have access to case discussions." };
    authorRole = "admin";
  } else if (user.role === "consultant") {
    if (!c.userId) return { error: "Case not found." };
    const assignment = await db.consultantAssignment.findFirst({
      where: { consultantId: user.id, userId: c.userId, status: "active" },
    });
    if (!assignment) return { error: "You don't have an active connection to this client." };
    authorRole = "consultant";
  } else {
    if (c.userId !== user.id) return { error: "Case not found." };
    authorRole = "customer";
  }

  // Resolve visibility from the role + admin-controlled toggles.
  let visibility = "all";
  if (hide) {
    if (authorRole === "customer" && (await getBoolSetting("comments.customer_private_enabled", true))) {
      visibility = "private";
    } else if (authorRole === "consultant" && (await getBoolSetting("comments.consultant_hide_from_customer_enabled", true))) {
      visibility = "hidden_from_customer";
    } else if (authorRole === "admin" && (await getBoolSetting("comments.admin_hide_from_customer_enabled", true))) {
      visibility = "hidden_from_customer";
    }
  }

  await db.caseComment.create({
    data: { caseId, authorId: user.id, authorRole, body, visibility },
  });

  // Notify the people who can see it.
  const { formatCaseNumber } = await import("@/lib/case-number");
  const ref = formatCaseNumber(c.number);
  if (visibility !== "private") {
    if (authorRole !== "customer" && c.userId && visibility === "all") {
      await db.notification.create({
        data: {
          userId: c.userId,
          kind: "info",
          title: `New comment on your case ${ref}`,
          body: body.slice(0, 120),
          link: `/app/cases/${caseId}`,
        },
      });
    }
    if (authorRole === "customer" && c.userId) {
      const assignment = await db.consultantAssignment.findFirst({
        where: { userId: c.userId, status: "active" },
      });
      if (assignment) {
        await db.notification.create({
          data: {
            userId: assignment.consultantId,
            kind: "info",
            title: `Client commented on case ${ref}`,
            body: body.slice(0, 120),
            link: `/consultant/clients/${assignment.id}/cases/${caseId}`,
          },
        });
      }
    }
  }

  revalidatePath(`/app/cases/${caseId}`);
  revalidatePath(`/admin/cases/${caseId}`);
  return { ok: true };
}
