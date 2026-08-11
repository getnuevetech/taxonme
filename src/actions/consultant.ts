"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { ROLES } from "@/lib/constants";
import type { ActionState } from "./auth";

// Full consultant onboarding (IRS-standard): credentials, PTIN/EFIN, document
// uploads (license proof, photo ID, E&O insurance), business details,
// specialties, and compliance attestation.
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
      const saved = await saveUpload(file);
      return saved.filePath;
    }
    return previous;
  }
  const proofDocumentPath = await pickUpload("proof", existing?.proofDocumentPath ?? "");
  const photoIdPath = await pickUpload("photoId", existing?.photoIdPath ?? "");
  const insurancePath = await pickUpload("insurance", existing?.insurancePath ?? "");

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

  if (!qualifies) {
    const admins = await db.user.findMany({ where: { role: { in: ["super_admin", "admin"] }, status: "active" } });
    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          kind: "info",
          title: "Consultant application pending review",
          body: `${user.firstName} ${user.lastName} (${user.email}) submitted a consultant application.`,
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
