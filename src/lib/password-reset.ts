import "server-only";
import crypto from "crypto";
import { db } from "./db";
import { getSetting } from "./settings";

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Creates a single-use reset token (1 hour validity) and returns the raw link.
export async function createResetLink(userId: string, byAdmin = false): Promise<string> {
  // Invalidate any previous outstanding tokens for this user.
  await db.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });
  const raw = crypto.randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      createdByAdmin: byAdmin,
    },
  });
  const appUrl = (await getSetting("app.url", "http://localhost:3000")).replace(/\/$/, "");
  return `${appUrl}/reset-password?token=${raw}`;
}

// Validates a raw token; returns the userId or null.
export async function validateResetToken(raw: string): Promise<string | null> {
  if (!raw) return null;
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row.userId;
}

// Marks a token consumed (call after the password is changed).
export async function consumeResetToken(raw: string): Promise<void> {
  await db.passwordResetToken.updateMany({
    where: { tokenHash: hashToken(raw) },
    data: { usedAt: new Date() },
  });
}
