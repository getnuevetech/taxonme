"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword, getCurrentUser } from "@/lib/auth";
import { claimGuestSession } from "@/lib/guest";
import { ROLES } from "@/lib/constants";

export type ActionState = { error?: string; ok?: boolean } | null;

const registerSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("A valid email is required"),
  phone: z.string().optional().default(""),
  password: z.string().min(8, "Password must be at least 8 characters"),
  agree: z.literal("on", { message: "You must accept the agreement to continue" }),
});

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { firstName, lastName, email, phone, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return { error: "An account with this email already exists. Try signing in." };

  const asConsultant = formData.get("asConsultant") === "1";
  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      phone,
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

  // Attach any pre-registration guest data (cases, documents, Q&A) to the new account.
  await claimGuestSession(user.id);
  await createSession(user.id);
  redirect(asConsultant ? "/consultant/onboarding" : "/app");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
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
  // Users can delete their profile at will. Cascade removes their data.
  await db.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/?deleted=1");
}
