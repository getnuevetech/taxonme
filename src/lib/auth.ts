import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cache } from "react";
import { db } from "./db";
import { ROLES } from "./constants";

const SESSION_COOKIE = "taxonme_session";

// Module-level cache so getSecret() only hits the database once per process.
// Stored as a Promise so concurrent cold requests await the same pending fetch
// rather than each racing to write a (potentially different) resolved value.
let _secretPromise: Promise<Uint8Array> | null = null;

function passwordFingerprint(passwordHash: string | null | undefined): string {
  return crypto.createHash("sha256").update(passwordHash || "no-password").digest("hex");
}

// The signing secret must come from AUTH_SECRET in production. Local/dev runs
// can fall back to a generated DB setting so onboarding remains easy.
async function getSecret(): Promise<Uint8Array> {
  if (!_secretPromise) {
    _secretPromise = (async () => {
      if (process.env.AUTH_SECRET) return new TextEncoder().encode(process.env.AUTH_SECRET);
      if (process.env.NODE_ENV === "production") {
        throw new Error("AUTH_SECRET must be set in production.");
      }
      let row = await db.setting.findUnique({ where: { key: "auth.secret" } });
      if (!row) {
        row = await db.setting.upsert({
          where: { key: "auth.secret" },
          update: {},
          create: {
            key: "auth.secret",
            value: crypto.randomBytes(32).toString("hex"),
            type: "secret",
            group: "security",
            label: "Session signing secret",
          },
        });
      }
      return new TextEncoder().encode(row.value);
    })();
  }
  return _secretPromise;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

// Mark cookies Secure only when the app is actually served over HTTPS
// (from the admin-managed App URL setting). Following NODE_ENV alone breaks
// plain-HTTP local deployments: Safari drops Secure cookies on http://localhost.
export async function secureCookiesEnabled(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: "app.url" } });
  return (row?.value ?? "").trim().toLowerCase().startsWith("https://");
}

export async function createSession(userId: string) {
  const secret = await getSecret();
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user) throw new Error("Cannot create a session for a missing user.");
  const token = await new SignJWT({ sub: userId, pwd: passwordFingerprint(user.passwordHash) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await secureCookiesEnabled(),
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const secret = await getSecret();
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    const user = await db.user.findUnique({
      where: { id: String(payload.sub) },
      include: { adminPermissions: true, adminRole: true, consultantProfile: true },
    });
    if (!user || user.status !== "active") return null;
    if (payload.pwd !== passwordFingerprint(user.passwordHash)) return null;
    return user;
  } catch {
    return null;
  }
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export function isAdmin(user: { role: string }) {
  return user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN;
}

export function hasAdminArea(user: CurrentUser, areaKey: string) {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  if (user.role !== ROLES.ADMIN) return false;
  // Areas come from the assigned role; legacy per-user permissions still count.
  if (user.adminRole) {
    try {
      const areas: string[] = JSON.parse(user.adminRole.areasJson || "[]");
      if (areas.includes(areaKey)) return true;
    } catch {
      // fall through to per-user permissions
    }
  }
  return user.adminPermissions.some((p) => p.featureKey === areaKey);
}

export async function requireAdminArea(areaKey: string) {
  const user = await requireUser();
  if (!hasAdminArea(user, areaKey)) throw new Error("FORBIDDEN");
  return user;
}
