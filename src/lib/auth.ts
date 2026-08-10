import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cache } from "react";
import { db } from "./db";
import { ROLES } from "./constants";

const SESSION_COOKIE = "taxonme_session";

// The signing secret is admin-manageable: env var wins, otherwise a random
// secret is generated once and stored in the settings table.
async function getSecret(): Promise<Uint8Array> {
  if (process.env.AUTH_SECRET) return new TextEncoder().encode(process.env.AUTH_SECRET);
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
export async function useSecureCookies(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: "app.url" } });
  return (row?.value ?? "").trim().toLowerCase().startsWith("https://");
}

export async function createSession(userId: string) {
  const secret = await getSecret();
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await useSecureCookies(),
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
      where: { id: payload.sub },
      include: { adminPermissions: true, consultantProfile: true },
    });
    if (!user || user.status !== "active") return null;
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
  return user.adminPermissions.some((p) => p.featureKey === areaKey);
}

export async function requireAdminArea(areaKey: string) {
  const user = await requireUser();
  if (!hasAdminArea(user, areaKey)) throw new Error("FORBIDDEN");
  return user;
}
