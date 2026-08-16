import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { timingSafeStringEqual } from "@/lib/secrets";

// Inbound email → ticket. Point your email provider's inbound webhook here
// (SendGrid Inbound Parse, Mailgun Routes, Postmark Inbound all work):
//   POST <app.url>/api/inbound-email
//   Header: x-inbound-secret: <tickets.inbound_email_secret>
// Accepts JSON or form data with fields: from, subject, text.
// - Subject containing TKT-000123 → reply is appended to that ticket (reopens it).
// - Otherwise → a new customer-service ticket is created.
// - Sender must match a registered account; unknown senders are ignored.
export async function POST(request: Request) {
  const secret = await getSetting("tickets.inbound_email_secret", "");
  if (!secret) return NextResponse.json({ error: "Inbound email is not enabled" }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  // Accept the secret only via a header to avoid it appearing in server access logs.
  const provided = request.headers.get("x-inbound-secret") ?? "";
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "unknown").trim();
  if (!checkRateLimit(rateLimitKey(["inbound-email", ip]), 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  if (!timingSafeStringEqual(provided, secret)) {
    const { logSystem } = await import("@/lib/syslog");
    await logSystem("warning", "inbound_email", "Inbound email rejected: invalid secret");
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  let from = "";
  let subject = "";
  let text = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    from = String(body.from ?? "");
    subject = String(body.subject ?? "");
    text = String(body.text ?? body.body ?? "");
  } else {
    const form = await request.formData().catch(() => null);
    from = String(form?.get("from") ?? "");
    subject = String(form?.get("subject") ?? "");
    text = String(form?.get("text") ?? form?.get("body-plain") ?? "");
  }

  // Extract the bare email address ("Name <a@b.com>" → a@b.com).
  const email = (from.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) ?? [""])[0].toLowerCase();
  if (!email || !text.trim()) return NextResponse.json({ ok: true, ignored: "missing sender or body" });

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.status !== "active" || (user.role !== "user" && user.role !== "consultant")) {
    return NextResponse.json({ ok: true, ignored: "unknown sender" });
  }

  // Reply to an existing ticket?
  const numberMatch = subject.match(/TKT-?0*(\d+)/i);
  if (numberMatch) {
    const ticket = await db.ticket.findFirst({ where: { number: Number(numberMatch[1]), userId: user.id } });
    if (ticket) {
      await db.ticketMessage.create({
        data: { ticketId: ticket.id, authorId: user.id, fromStaff: false, body: text.slice(0, 5000) },
      });
      const reopened = ticket.status === "resolved" || ticket.status === "closed";
      await db.ticket.update({
        where: { id: ticket.id },
        data: reopened ? { status: "open", resolvedAt: null, closedAt: null } : {},
      });
      const recipients = ticket.assignedToId
        ? [{ id: ticket.assignedToId }]
        : await db.user.findMany({ where: { role: { in: ["super_admin", "admin"] }, status: "active" }, select: { id: true } });
      for (const r of recipients) {
        await db.notification.create({
          data: {
            userId: r.id,
            kind: "info",
            title: reopened ? "Ticket reopened by email reply" : "Email reply on a ticket",
            body: ticket.subject.slice(0, 100),
            link: `/admin/tickets/${ticket.id}`,
          },
        });
      }
      return NextResponse.json({ ok: true, ticket: ticket.id, action: "replied" });
    }
  }

  // New ticket from email.
  const ticket = await db.ticket.create({
    data: {
      userId: user.id,
      subject: (subject || "Email from customer").slice(0, 150),
      category: "customer_service",
      source: "email",
      messages: { create: { authorId: user.id, fromStaff: false, body: text.slice(0, 5000) } },
    },
  });
  const admins = await db.user.findMany({ where: { role: { in: ["super_admin", "admin"] }, status: "active" }, select: { id: true } });
  for (const a of admins) {
    await db.notification.create({
      data: {
        userId: a.id,
        kind: "info",
        title: "New ticket from inbound email",
        body: `${email}: ${subject.slice(0, 80)}`,
        link: `/admin/tickets/${ticket.id}`,
      },
    });
  }
  return NextResponse.json({ ok: true, ticket: ticket.id, action: "created" });
}
