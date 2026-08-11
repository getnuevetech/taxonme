import "server-only";
import nodemailer from "nodemailer";
import { getSettingsMap } from "./settings";

// Outbound email. SMTP settings are managed by the admin (Settings → mail).
// When SMTP isn't configured, sendMail reports sent:false and callers fall
// back gracefully (e.g. the admin is shown the reset link to deliver manually).

export async function sendMail(to: string, subject: string, text: string): Promise<{ sent: boolean; error?: string }> {
  const s = await getSettingsMap(["mail.host", "mail.port", "mail.username", "mail.password", "mail.from", "mail.secure"]);
  if (!s["mail.host"]) return { sent: false, error: "SMTP not configured" };
  try {
    const transporter = nodemailer.createTransport({
      host: s["mail.host"],
      port: Number(s["mail.port"] || 587),
      secure: s["mail.secure"] === "true",
      auth: s["mail.username"] ? { user: s["mail.username"], pass: s["mail.password"] ?? "" } : undefined,
    });
    await transporter.sendMail({
      from: s["mail.from"] || s["mail.username"],
      to,
      subject,
      text,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: String(err).slice(0, 300) };
  }
}
