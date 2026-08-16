"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword, getCurrentUser } from "@/lib/auth";
import { claimGuestSession } from "@/lib/guest";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { ROLES } from "@/lib/constants";

export type ActionState = { error?: string; ok?: boolean; info?: string; link?: string } | null;

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  password: z.string().min(8, "Password must be at least 8 characters"),
  agree: z.literal("on", { message: "You must accept the agreement to continue" }),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { firstName, lastName, email, phone, address, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { error: "An account with this email already exists. Try signing in." };

  const asConsultant = formData.get("asConsultant") === "1";
  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      phone,
      address,
      firstName,
      lastName,
      passwordHash: await hashPassword(password),
      role: asConsultant ? ROLES.CONSULTANT : ROLES.USER,
    },
  });

  // Record acceptance of the current published agreement (admin-managed content).
  const agreementKind = asConsultant ? "agreement_consultant" : "agreement_user";
  const agreement = await db.contentPage.findFirst({
    where: { kind: agreementKind, isPublished: true },
    orderBy: { version: "desc" },
  });
  if (agreement) {
    await db.agreementAcceptance.create({
      data: { userId: user.id, pageId: agreement.id, version: agreement.version, context: "registration" },
    });
  }

  // Welcome message (admin-editable template).
  const { sendSystemMessage } = await import("@/lib/messaging");
  await sendSystemMessage("account_created", user, { link: asConsultant ? "/consultant" : "/app" });

  // Attach any pre-registration guest data (cases, documents, Q&A) to the new account.
  await claimGuestSession(user.id);
  await createSession(user.id);
  redirect(asConsultant ? "/consultant/onboarding" : "/app");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const limitedKey = rateLimitKey(["login", email, await clientIp()]);
  if (!checkRateLimit(limitedKey, 8, 15 * 60 * 1000)) {
    return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Invalid email or password." };
  }
  if (user.status !== "active") return { error: "This account is not active." };
  await claimGuestSession(user.id);
  await createSession(user.id);
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) redirect("/admin");
  if (user.role === ROLES.CONSULTANT) redirect("/consultant");
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function deleteAccountAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Soft delete: the account moves to the admin "Deleted accounts" section and
  // is expunged automatically after the configured retention period.
  await db.user.update({
    where: { id: user.id },
    data: { status: "deleted", deletedAt: new Date() },
  });
  await destroySession();
  redirect("/?deleted=1");
}

// ---------- Password reset (customers & consultants) ----------

export async function requestPasswordResetAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Enter your email address." };
  const limitedKey = rateLimitKey(["password-reset", email, await clientIp()]);
  if (!checkRateLimit(limitedKey, 3, 60 * 60 * 1000)) {
    return { error: "Too many reset requests. Wait a while before trying again." };
  }
  const user = await db.user.findUnique({ where: { email } });
  // Same response whether or not the account exists (no user enumeration).
  if (user && user.status === "active") {
    const { createResetLink } = await import("@/lib/password-reset");
    const link = await createResetLink(user.id);
    const { sendSystemMessage } = await import("@/lib/messaging");
    const sent = await sendSystemMessage("password_reset", user, { link });
    if (!sent) {
      const { sendMail } = await import("@/lib/mail");
      await sendMail(
        email,
        "Reset your password",
        `Hi ${user.firstName || ""},\n\nUse the link below to choose a new password. It expires in 1 hour.\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
      );
    }
  }
  return {
    ok: true,
  };
}

export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const limitedKey = rateLimitKey(["password-reset-submit", await clientIp()]);
  if (!checkRateLimit(limitedKey, 10, 15 * 60 * 1000)) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  const { validateResetToken, consumeResetToken } = await import("@/lib/password-reset");
  const userId = await validateResetToken(token);
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };

  // Guard against resetting a soft-deleted or suspended account.
  const existingUser = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!existingUser || existingUser.status !== "active") {
    return { error: "This account is not active. Contact support if you believe this is a mistake." };
  }

  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  await consumeResetToken(token);
  redirect("/login?reset=1");
}
