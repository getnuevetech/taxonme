import "server-only";
import { db } from "./db";
import { sendMail } from "./mail";
import { getSetting } from "./settings";

// System message engine: every customer-facing communication is an
// admin-editable HTML template. Messages are delivered by email (when SMTP is
// configured) AND as an in-app notification, and every send is logged.

export type MessageVars = Record<string, string>;

function render(text: string, vars: MessageVars): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function baseVars(user: { firstName: string; lastName: string; email: string }): Promise<MessageVars> {
  const [appName, appUrl] = await Promise.all([
    getSetting("app.name", "TaxOnMe"),
    getSetting("app.url", "http://localhost:3000"),
  ]);
  return {
    firstName: user.firstName || "there",
    lastName: user.lastName,
    email: user.email,
    appName,
    appUrl: appUrl.replace(/\/$/, ""),
  };
}

/**
 * Send a templated system message to a user (email + in-app notification).
 * Skips silently when the template is disabled. dedupeKey prevents scheduled
 * duplicates.
 */
export async function sendSystemMessage(
  templateKey: string,
  user: { id: string; firstName: string; lastName: string; email: string },
  extraVars: MessageVars = {},
  dedupeKey?: string,
): Promise<boolean> {
  const template = await db.messageTemplate.findUnique({ where: { key: templateKey } });
  if (!template || !template.enabled) return false;
  if (dedupeKey) {
    const already = await db.messageLog.findUnique({ where: { dedupeKey } });
    if (already) return false;
  }

  const vars = { ...(await baseVars(user)), ...extraVars };
  const subject = render(template.subject, vars);
  const html = render(template.bodyHtml, vars);
  const text = stripHtml(html);

  const mail = await sendMail(user.email, subject, text, html);
  await db.notification.create({
    data: { userId: user.id, kind: "info", title: subject, body: text.slice(0, 300), link: extraVars.link ?? "" },
  });
  await db.messageLog.create({
    data: { templateKey, userId: user.id, dedupeKey: dedupeKey ?? null, emailSent: mail.sent },
  });
  return true;
}

/**
 * Scheduled subscription messages: templates with offsetDays fire relative to
 * each subscription's expiration (negative = before, positive = after, 0 = on
 * expiry while unrenewed). Deduped per subscription+template. Safe to run as
 * often as you like — call it from a daily cron or the admin "Run now" button.
 */
export async function processScheduledMessages(): Promise<number> {
  const templates = await db.messageTemplate.findMany({
    where: { kind: "scheduled", enabled: true, offsetDays: { not: null } },
  });
  if (templates.length === 0) return 0;

  const now = Date.now();
  const day = 24 * 3600000;
  let sent = 0;

  for (const tpl of templates) {
    const offset = tpl.offsetDays!;
    // Window: expiration falls within [now + offset*-1 day window].
    // offset -7 → periodEnd in (now+6d, now+7d]; offset +7 → periodEnd in [now-7d, now-6d).
    const windowStart = new Date(now - offset * day - day);
    const windowEnd = new Date(now - offset * day);
    const subs = await db.subscription.findMany({
      where: {
        status: { in: ["active", "trialing"] },
        currentPeriodEnd: { gte: windowStart, lt: windowEnd },
      },
      include: { user: true, plan: true },
    });
    for (const sub of subs) {
      if (sub.user.status !== "active") continue;
      // Post-expiry messages only when the user hasn't already renewed.
      if (offset >= 0) {
        const renewed = await db.subscription.count({
          where: {
            userId: sub.userId,
            status: { in: ["active", "trialing"] },
            currentPeriodEnd: { gte: new Date() },
            id: { not: sub.id },
          },
        });
        if (renewed > 0) continue;
      }
      const ok = await sendSystemMessage(
        tpl.key,
        sub.user,
        {
          planName: sub.plan.name,
          expiresOn: sub.currentPeriodEnd?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) ?? "",
          link: sub.plan.audience === "consultant" ? "/consultant/billing" : "/app/billing",
        },
        `${tpl.key}:${sub.id}`,
      );
      if (ok) sent++;
    }
  }
  return sent;
}
