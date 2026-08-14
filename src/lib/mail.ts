import "server-only";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getSettingsMap } from "./settings";

// Outbound email. SMTP settings are managed by the admin (Settings → mail).
// When SMTP isn't configured, sendMail reports sent:false and callers fall
// back gracefully (e.g. the admin is shown the reset link to deliver manually).

// Cache the transporter so the SMTP connection pool is reused across requests.
// The cached instance is invalidated whenever the settings fingerprint changes
// (host, port, credentials) so a settings update takes effect automatically.
let _transporterCache: { transporter: Transporter; fingerprint: string } | null = null;

function settingsFingerprint(s: Record<string, string | undefined>): string {
  return [s["mail.host"], s["mail.port"], s["mail.username"], s["mail.password"], s["mail.from"], s["mail.secure"]].join("|");
}

export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<{ sent: boolean; error?: string }> {
  const s = await getSettingsMap(["mail.host", "mail.port", "mail.username", "mail.password", "mail.from", "mail.secure"]);
  if (!s["mail.host"]) return { sent: false, error: "SMTP not configured" };
  try {
    const fp = settingsFingerprint(s);
    if (!_transporterCache || _transporterCache.fingerprint !== fp) {
      _transporterCache = {
        fingerprint: fp,
        transporter: nodemailer.createTransport({
          host: s["mail.host"],
          port: Number(s["mail.port"] || 587),
          secure: s["mail.secure"] === "true",
          auth: s["mail.username"] ? { user: s["mail.username"], pass: s["mail.password"] ?? "" } : undefined,
        }),
      };
    }
    await _transporterCache.transporter.sendMail({
      from: s["mail.from"] || s["mail.username"],
      to,
      subject,
      text,
      html: html || undefined,
    });
    return { sent: true };
  } catch (err) {
    const { logSystem } = await import("./syslog");
    await logSystem("error", "email", `Failed to send email to ${to}: ${subject.slice(0, 80)}`, String(err));
    return { sent: false, error: String(err).slice(0, 300) };
  }
}
