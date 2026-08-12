import "server-only";
import { db } from "./db";
import { getBoolSetting } from "./settings";

export type ViewerRole = "customer" | "consultant" | "admin";

// Comments visible to a given viewer:
// - customer: public comments + their own private notes (never staff-internal)
// - consultant: public + hidden-from-customer (admins can always see consultant comments)
// - admin: everything except customers' private notes
export async function getVisibleComments(caseId: string, role: ViewerRole, userId: string) {
  const where =
    role === "customer"
      ? { caseId, OR: [{ visibility: "all" }, { visibility: "private", authorId: userId }] }
      : role === "consultant"
        ? { caseId, visibility: { in: ["all", "hidden_from_customer"] } }
        : { caseId, visibility: { not: "private" } };
  const comments = await db.caseComment.findMany({ where, orderBy: { createdAt: "asc" } });
  const authors = await db.user.findMany({
    where: { id: { in: Array.from(new Set(comments.map((cm) => cm.authorId))) } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });
  // Resolve comment attachments (documents in the customer's vault).
  const attachmentIds = comments.flatMap((cm) => {
    try {
      const parsed = JSON.parse(cm.attachmentsJson || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });
  const docs = attachmentIds.length
    ? await db.document.findMany({
        where: { id: { in: attachmentIds }, deletedAt: null },
        select: { id: true, fileName: true, mimeType: true },
      })
    : [];
  return comments.map((cm) => {
    const a = authors.find((x) => x.id === cm.authorId);
    let ids: string[] = [];
    try {
      const parsed = JSON.parse(cm.attachmentsJson || "[]");
      if (Array.isArray(parsed)) ids = parsed.map(String);
    } catch { /* legacy comments */ }
    return {
      id: cm.id,
      body: cm.body,
      visibility: cm.visibility,
      authorRole: cm.authorRole,
      authorName: a ? `${a.firstName} ${a.lastName}`.trim() || a.email : "(deleted account)",
      isOwn: cm.authorId === userId,
      createdAt: cm.createdAt,
      attachments: ids
        .map((id) => docs.find((d) => d.id === id))
        .filter((d): d is (typeof docs)[number] => Boolean(d)),
    };
  });
}

// Which visibility checkbox (if any) the composer shows for this role.
export async function getComposerCheckbox(role: ViewerRole): Promise<string | null> {
  if (role === "customer" && (await getBoolSetting("comments.customer_private_enabled", true))) {
    return "Private note — visible only to me (not the consultant or support team)";
  }
  if (role === "consultant" && (await getBoolSetting("comments.consultant_hide_from_customer_enabled", true))) {
    return "Hide from customer — visible to the support team (admins always see consultant comments)";
  }
  if (role === "admin" && (await getBoolSetting("comments.admin_hide_from_customer_enabled", true))) {
    return "Internal — hidden from the customer (visible to consultants and staff)";
  }
  return null;
}
