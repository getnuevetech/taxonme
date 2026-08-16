"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { saveUpload, validateImageUploadFile, validateUploadFile } from "@/lib/uploads";
import { ROLES } from "@/lib/constants";
import type { ActionState } from "./auth";

// Full consultant onboarding (IRS-standard): credentials, PTIN/EFIN, document
// uploads (license proof, photo ID, E&O insurance), business details,
// specialties, and compliance attestation.
// Personal profile (photo, contact, address, bio, languages) — separate from
// the credentials/onboarding flow. Every field counts toward completeness but
// none is enforced at signup.
export async function consultantUpdateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== ROLES.CONSULTANT) return { error: "Consultant account required." };

  let avatarPath: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    const validationError = validateImageUploadFile(avatar);
    if (validationError) return { error: validationError };
    avatarPath = (await saveUpload(avatar)).filePath;
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      firstName: String(formData.get("firstName") ?? "").trim(),
      lastName: String(formData.get("lastName") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      bio: String(formData.get("bio") ?? "").trim(),
      ...(avatarPath ? { avatarPath } : {}),
    },
  });
  // Languages/website live on the consultant profile (created at onboarding;
  // upserted here so the fields save even before onboarding is submitted).
  await db.consultantProfile.upsert({
    where: { userId: user.id },
    update: {
      languages: String(formData.get("languages") ?? "").trim(),
      website: String(formData.get("website") ?? "").trim(),
    },
    create: {
      userId: user.id,
      languages: String(formData.get("languages") ?? "").trim(),
      website: String(formData.get("website") ?? "").trim(),
    },
  });
  revalidatePath("/consultant/profile");
  revalidatePath("/consultant");
  return { ok: true };
}

export async function consultantOnboardingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== ROLES.CONSULTANT) return { error: "Only consultant accounts can complete this onboarding." };
  const existing = await db.consultantProfile.findUnique({ where: { userId: user.id } });

  const credentialType = String(formData.get("credentialType") ?? "tax_consultant");
  const credentialNumber = String(formData.get("credentialNumber") ?? "").trim();
  const licenseState = String(formData.get("licenseState") ?? "").trim();
  const ptin = String(formData.get("ptin") ?? "").trim();
  const efin = String(formData.get("efin") ?? "").trim();
  const isBusiness = formData.get("isBusiness") === "on";
  const businessName = String(formData.get("businessName") ?? "").trim();
  const ein = String(formData.get("ein") ?? "").trim();
  const statesServed = String(formData.get("statesServed") ?? "").trim();
  const yearsExperience = Number(formData.get("yearsExperience") ?? 0) || 0;
  const specialties = formData.getAll("specialties").map(String);
  const attestedCompliance = formData.get("attestation") === "on";
  const agree = formData.get("agree") === "on";

  if (!agree) return { error: "You must accept the consultant agreement." };
  if ((credentialType === "cpa" || credentialType === "ea") && !credentialNumber) {
    return { error: "License/enrollment number is required for CPA and EA credentials." };
  }
  if (credentialType === "cpa" && !licenseState) {
    return { error: "State of licensure is required for CPAs." };
  }
  if (isBusiness && !businessName) return { error: "Business name is required for business accounts." };
  if (specialties.length === 0) return { error: "Select at least one area of specialty." };

  async function pickUpload(field: string, previous: string): Promise<string> {
    const file = formData.get(field);
    if (file instanceof File && file.size > 0) {
      const validationError = validateUploadFile(file);
      if (validationError) throw new Error(validationError);
      const saved = await saveUpload(file);
      return saved.filePath;
    }
    return previous;
  }
  let proofDocumentPath = "";
  let photoIdPath = "";
  let insurancePath = "";
  try {
    proofDocumentPath = await pickUpload("proof", existing?.proofDocumentPath ?? "");
    photoIdPath = await pickUpload("photoId", existing?.photoIdPath ?? "");
    insurancePath = await pickUpload("insurance", existing?.insurancePath ?? "");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "One of the uploaded files is not allowed." };
  }

  if ((credentialType === "cpa" || credentialType === "ea") && !proofDocumentPath) {
    return { error: "Please upload proof of your CPA license or EA enrollment." };
  }

  // Automated approval: every admin-required criterion must be satisfied.
  const { evaluateAutoApproval } = await import("@/lib/consultant-criteria");
  const evaluation = await evaluateAutoApproval({
    credentialType, credentialNumber, licenseState, ptin, efin,
    proofDocumentPath, photoIdPath, insurancePath,
    isBusiness, ein, statesServed, yearsExperience, attestedCompliance,
  });
  const qualifies = evaluation.qualifies;

  const data = {
    credentialType, credentialNumber, licenseState, ptin, efin,
    isBusiness, businessName, ein, statesServed, yearsExperience,
    specialties: JSON.stringify(specialties),
    proofDocumentPath, photoIdPath, insurancePath, attestedCompliance,
    status: qualifies ? "approved" : "pending",
    autoApproved: qualifies,
    approvedAt: qualifies ? new Date() : null,
  };
  await db.consultantProfile.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data },
  });

  const agreement = await db.contentPage.findFirst({
    where: { kind: "agreement_consultant", isPublished: true },
    orderBy: { version: "desc" },
  });
  if (agreement) {
    await db.agreementAcceptance.create({
      data: { userId: user.id, pageId: agreement.id, version: agreement.version, context: "consultant_signup" },
    });
  }

  const admins = await db.user.findMany({ where: { role: { in: ["super_admin", "admin"] }, status: "active" } });
  if (!qualifies) {
    const failed = evaluation.results.filter((r) => r.required && !r.satisfied).map((r) => r.name);
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          kind: "info",
          title: "Consultant application pending review",
          body: `${user.firstName} ${user.lastName} (${user.email}) applied.${evaluation.enabled && failed.length ? ` Auto-approval missed: ${failed.slice(0, 3).join("; ")}.` : ""}`,
          link: "/admin/consultants",
        },
      });
    }
  } else {
    // Auto-approved: tell the consultant and log it for the admins.
    await db.notification.create({
      data: {
        userId: user.id,
        kind: "info",
        title: "Your consultant account is approved",
        body: "Your application met all automated approval criteria — you can now be assigned clients.",
        link: "/consultant",
      },
    });
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          kind: "info",
          title: "Consultant auto-approved",
          body: `${user.firstName} ${user.lastName} (${user.email}) met all automated approval criteria.`,
          link: "/admin/consultants",
        },
      });
    }
  }
  redirect("/consultant?submitted=1");
}

// ---------- Experience & past cases (feeds the AI matching engine) ----------

export async function saveExperiencesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== ROLES.CONSULTANT) return { error: "Consultant account required." };
  const experiences = String(formData.get("experiences") ?? "").slice(0, 3000);
  const profile = await db.consultantProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return { error: "Complete your onboarding first." };
  await db.consultantProfile.update({ where: { id: profile.id }, data: { experiences } });
  revalidatePath("/consultant/experience");
  return { ok: true };
}

export async function addPastCaseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (user.role !== ROLES.CONSULTANT) return { error: "Consultant account required." };
  const profile = await db.consultantProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return { error: "Complete your onboarding first." };
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give the case a short title (no client names)." };
  await db.consultantPastCase.create({
    data: {
      profileId: profile.id,
      title: title.slice(0, 150),
      category: String(formData.get("category") ?? "other"),
      description: String(formData.get("description") ?? "").slice(0, 1500),
      year: Number(formData.get("year") ?? 0) || null,
      outcome: String(formData.get("outcome") ?? "").slice(0, 300),
    },
  });
  revalidatePath("/consultant/experience");
  return { ok: true };
}

export async function deletePastCaseAction(id: string) {
  const user = await requireUser();
  const pc = await db.consultantPastCase.findUnique({ where: { id }, include: { profile: true } });
  if (!pc || pc.profile.userId !== user.id) return;
  await db.consultantPastCase.delete({ where: { id } });
  revalidatePath("/consultant/experience");
}

// Consultant accepts/declines a client connection (mutual consent).
export async function consultantRespondAssignmentAction(assignmentId: string, accept: boolean) {
  const user = await requireUser();
  const a = await db.consultantAssignment.findUnique({ where: { id: assignmentId } });
  if (!a || a.consultantId !== user.id) return;
  if (accept) {
    // When partner subscriptions are enabled, an active plan is required to take clients.
    const { consultantSubscriptionsEnabled, hasActiveConsultantSubscription } = await import("@/lib/payments");
    if ((await consultantSubscriptionsEnabled()) && !(await hasActiveConsultantSubscription(user.id))) {
      redirect("/consultant/billing?required=1");
    }
  }
  if (!accept) {
    await db.consultantAssignment.update({ where: { id: assignmentId }, data: { status: "declined" } });
  } else {
    const bothAgreed = !!a.userAgreedAt;
    await db.consultantAssignment.update({
      where: { id: assignmentId },
      data: { status: bothAgreed ? "active" : "proposed", consultantAgreedAt: new Date() },
    });
    if (bothAgreed) {
      await db.notification.create({
        data: {
          userId: a.userId,
          kind: "assignment",
          title: "Your consultant connection is active",
          body: "Your consultant can now review the documents you've shared.",
          link: "/app/consultants",
        },
      });
    }
  }
  revalidatePath("/consultant");
}
