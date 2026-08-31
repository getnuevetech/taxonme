import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "./db";
import { secureCookiesEnabled } from "./auth";
import {
  sanitizeAuthNext,
  type ClaimedGuestWork,
} from "./auth-continue";

export {
  continuePathAfterAuth,
  sanitizeAuthNext,
  type ClaimedGuestWork,
} from "./auth-continue";

const GUEST_COOKIE = "taxonme_guest";
/** Survives Google OAuth round-trip so we can resume the guest conversation. */
export const AUTH_NEXT_COOKIE = "taxonme_auth_next";

// Guest sessions let visitors start their tax intake without an account.
// Everything they provide is stored against the session and attached to
// their account when they register.

export async function getOrCreateGuestSession() {
  const jar = await cookies();
  const token = jar.get(GUEST_COOKIE)?.value;
  if (token) {
    const existing = await db.guestSession.findUnique({ where: { token } });
    if (existing && !existing.claimedAt) return existing;
  }
  const created = await db.guestSession.create({
    data: { token: crypto.randomBytes(24).toString("hex") },
  });
  jar.set(GUEST_COOKIE, created.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookiesEnabled(),
    maxAge: 60 * 60 * 24 * 14,
    path: "/",
  });
  return created;
}

export async function getGuestSession() {
  const jar = await cookies();
  const token = jar.get(GUEST_COOKIE)?.value;
  if (!token) return null;
  const s = await db.guestSession.findUnique({ where: { token } });
  return s && !s.claimedAt ? s : null;
}

export async function setAuthNextCookie(next: string | null | undefined) {
  const safe = sanitizeAuthNext(next);
  const jar = await cookies();
  if (!safe) {
    jar.delete(AUTH_NEXT_COOKIE);
    return;
  }
  jar.set(AUTH_NEXT_COOKIE, safe, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookiesEnabled(),
    maxAge: 60 * 30,
    path: "/",
  });
}

export async function consumeAuthNextCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = sanitizeAuthNext(jar.get(AUTH_NEXT_COOKIE)?.value);
  jar.delete(AUTH_NEXT_COOKIE);
  return value;
}

// Attach all guest data (cases, documents, Q&A) to the newly registered user.
export async function claimGuestSession(userId: string): Promise<ClaimedGuestWork | null> {
  const session = await getGuestSession();
  if (!session) return null;
  await db.$transaction([
    db.case.updateMany({ where: { guestSessionId: session.id }, data: { userId } }),
    db.document.updateMany({ where: { guestSessionId: session.id }, data: { userId } }),
    db.qaThread.updateMany({ where: { guestSessionId: session.id }, data: { userId } }),
    db.guestSession.update({
      where: { id: session.id },
      data: { claimedByUserId: userId, claimedAt: new Date() },
    }),
  ]);
  const jar = await cookies();
  jar.delete(GUEST_COOKIE);

  const [thread, caseRow] = await Promise.all([
    db.qaThread.findFirst({
      where: { userId, guestSessionId: session.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    db.case.findFirst({
      where: { userId, guestSessionId: session.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    }),
  ]);

  return {
    sessionId: session.id,
    threadId: thread?.id ?? null,
    caseId: caseRow?.id ?? null,
  };
}
