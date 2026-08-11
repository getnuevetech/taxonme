"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdminArea, hashPassword } from "@/lib/auth";
import { setSetting } from "@/lib/settings";
import type { ActionState } from "./auth";

// ---------- Settings ----------

export async function saveSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.settings");
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("setting:")) await setSetting(key.slice(8), String(value));
  }
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function addSettingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.settings");
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return { error: "Key is required." };
  await db.setting.upsert({
    where: { key },
    update: { value: String(formData.get("value") ?? "") },
    create: {
      key,
      value: String(formData.get("value") ?? ""),
      group: String(formData.get("group") ?? "general"),
      label: String(formData.get("label") ?? key),
      type: String(formData.get("type") ?? "text"),
    },
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

// ---------- AI providers ----------

export async function saveAiProviderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.ai");
  const id = String(formData.get("id") ?? "");
  const apiKeyInput = String(formData.get("apiKey") ?? "");
  const data = {
    name: String(formData.get("name") ?? "").trim(),
    kind: String(formData.get("kind") ?? "openai_compatible"),
    baseUrl: String(formData.get("baseUrl") ?? "").trim(),
    model: String(formData.get("model") ?? "").trim(),
    maxTokens: Number(formData.get("maxTokens") ?? 4096) || 4096,
    temperature: Number(formData.get("temperature") ?? 0.2) || 0.2,
    supportsVision: formData.get("supportsVision") === "on",
    isEnabled: formData.get("isEnabled") === "on",
    notes: String(formData.get("notes") ?? ""),
  };
  if (!data.name || !data.model) return { error: "Name and model are required." };
  if (id) {
    // Keep the stored key when the masked placeholder is submitted unchanged.
    await db.aiProvider.update({
      where: { id },
      data: apiKeyInput && !apiKeyInput.includes("••") ? { ...data, apiKey: apiKeyInput } : data,
    });
  } else {
    await db.aiProvider.create({ data: { ...data, apiKey: apiKeyInput.includes("••") ? "" : apiKeyInput } });
  }
  revalidatePath("/admin/ai-providers");
  return { ok: true };
}

export async function deleteAiProviderAction(id: string) {
  await requireAdminArea("admin.ai");
  await db.aiProvider.delete({ where: { id } });
  revalidatePath("/admin/ai-providers");
}

// ---------- Pipelines ----------

export async function savePipelineStepAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.pipelines");
  const id = String(formData.get("id") ?? "");
  const data = {
    stageKey: String(formData.get("stageKey") ?? ""),
    providerId: String(formData.get("providerId") ?? ""),
    role: String(formData.get("role") ?? "analyst"),
    promptTemplate: String(formData.get("promptTemplate") ?? ""),
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    isEnabled: formData.get("isEnabled") === "on",
  };
  if (!data.stageKey || !data.providerId || !data.promptTemplate) {
    return { error: "Stage, provider, and prompt are required." };
  }
  if (id) await db.pipelineStep.update({ where: { id }, data });
  else await db.pipelineStep.create({ data });
  revalidatePath("/admin/pipelines");
  return { ok: true };
}

export async function deletePipelineStepAction(id: string) {
  await requireAdminArea("admin.pipelines");
  await db.pipelineStep.delete({ where: { id } });
  revalidatePath("/admin/pipelines");
}

export async function toggleStageAction(stageKey: string, enabled: boolean) {
  await requireAdminArea("admin.pipelines");
  await db.pipelineStage.update({ where: { key: stageKey }, data: { isEnabled: enabled } });
  revalidatePath("/admin/pipelines");
}

// ---------- Plans & feature access control ----------

export async function savePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.plans");
  const id = String(formData.get("id") ?? "");
  const data = {
    key: String(formData.get("key") ?? "").trim().toLowerCase(),
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? ""),
    priceMonthlyCents: Math.round(Number(formData.get("priceMonthly") ?? 0) * 100) || 0,
    priceYearlyCents: Math.round(Number(formData.get("priceYearly") ?? 0) * 100) || 0,
    badge: String(formData.get("badge") ?? ""),
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
    isActive: formData.get("isActive") === "on",
  };
  if (!data.key || !data.name) return { error: "Key and name are required." };
  if (id) await db.subscriptionPlan.update({ where: { id }, data });
  else await db.subscriptionPlan.create({ data });
  revalidatePath("/admin/plans");
  return { ok: true };
}

export async function saveFeatureMatrixAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.plans");
  const plans = await db.subscriptionPlan.findMany();
  const features = await db.featureDef.findMany();
  for (const plan of plans) {
    for (const feature of features) {
      const enabled = formData.get(`f:${plan.id}:${feature.key}`) === "on";
      const limitRaw = String(formData.get(`l:${plan.id}:${feature.key}`) ?? "").trim();
      const limitValue = limitRaw === "" ? null : Number(limitRaw) || null;
      await db.planFeature.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey: feature.key } },
        update: { enabled, limitValue },
        create: { planId: plan.id, featureKey: feature.key, enabled, limitValue },
      });
    }
  }
  revalidatePath("/admin/plans");
  return { ok: true };
}

// ---------- Payment gateways ----------

export async function saveGatewayAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.payments");
  const id = String(formData.get("id") ?? "");
  const configJson = String(formData.get("configJson") ?? "{}");
  try {
    JSON.parse(configJson);
  } catch {
    return { error: "Config must be valid JSON." };
  }
  const data = {
    name: String(formData.get("name") ?? "").trim(),
    kind: String(formData.get("kind") ?? "manual"),
    mode: String(formData.get("mode") ?? "test"),
    isActive: formData.get("isActive") === "on",
    isDefault: formData.get("isDefault") === "on",
    configJson,
  };
  if (!data.name) return { error: "Name is required." };
  if (data.isDefault) {
    await db.paymentGatewayConfig.updateMany({ data: { isDefault: false } });
  }
  if (id) await db.paymentGatewayConfig.update({ where: { id }, data });
  else await db.paymentGatewayConfig.create({ data });
  revalidatePath("/admin/payments");
  return { ok: true };
}

export async function deleteGatewayAction(id: string) {
  await requireAdminArea("admin.payments");
  await db.paymentGatewayConfig.delete({ where: { id } });
  revalidatePath("/admin/payments");
}

// ---------- Content & agreements ----------

export async function saveContentPageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.content");
  const id = String(formData.get("id") ?? "");
  const data = {
    slug: String(formData.get("slug") ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
    title: String(formData.get("title") ?? "").trim(),
    body: String(formData.get("body") ?? ""),
    kind: String(formData.get("kind") ?? "page"),
    audience: String(formData.get("audience") ?? "all"),
    isPublished: formData.get("isPublished") === "on",
  };
  if (!data.slug || !data.title) return { error: "Slug and title are required." };
  if (id) {
    const bumpVersion = formData.get("bumpVersion") === "on";
    await db.contentPage.update({
      where: { id },
      data: bumpVersion ? { ...data, version: { increment: 1 } } : data,
    });
  } else {
    await db.contentPage.create({ data });
  }
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function deleteContentPageAction(id: string) {
  await requireAdminArea("admin.content");
  await db.contentPage.delete({ where: { id } });
  revalidatePath("/admin/content");
}

// ---------- Users ----------

export async function setUserStatusAction(userId: string, status: "active" | "suspended") {
  await requireAdminArea("admin.users");
  await db.user.update({ where: { id: userId }, data: { status } });
  revalidatePath("/admin/users");
}

export async function adminDeleteUserAction(userId: string) {
  const admin = await requireAdminArea("admin.users");
  if (admin.id === userId) return;
  const target = await db.user.findUnique({ where: { id: userId } });
  if (target?.role === "super_admin") return;
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}

// ---------- Role management (standalone) ----------

export async function saveAdminRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.roles");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const areas = formData.getAll("areas").map(String);
  if (!name) return { error: "Role name is required." };
  if (areas.length === 0) return { error: "Select at least one admin area for this role." };

  const clash = await db.adminRole.findUnique({ where: { name } });
  if (clash && clash.id !== id) return { error: "A role with this name already exists." };

  const data = { name, description, areasJson: JSON.stringify(areas) };
  if (id) await db.adminRole.update({ where: { id }, data });
  else await db.adminRole.create({ data });
  revalidatePath("/admin/roles");
  revalidatePath("/admin/admins");
  return { ok: true };
}

export async function deleteAdminRoleAction(id: string) {
  await requireAdminArea("admin.roles");
  // Users keep their account; they simply lose the role (and its areas).
  await db.adminRole.delete({ where: { id } });
  revalidatePath("/admin/roles");
  revalidatePath("/admin/admins");
}

// ---------- Admin users ----------

export async function createAdminAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdminArea("admin.admins");
  if (actor.role !== "super_admin") return { error: "Only the super admin can create admin accounts." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  if (!email || password.length < 8) return { error: "Email and a password of 8+ characters are required." };
  if (!roleId) return { error: "Assign a role to this admin. Create roles under Roles & permissions." };
  const role = await db.adminRole.findUnique({ where: { id: roleId } });
  if (!role) return { error: "That role no longer exists." };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with this email already exists." };
  const admin = await db.user.create({
    data: {
      email,
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      passwordHash: await hashPassword(password),
      role: "admin",
      adminRoleId: role.id,
    },
  });
  revalidatePath("/admin/admins");
  return { ok: !!admin };
}

export async function assignAdminRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdminArea("admin.admins");
  if (actor.role !== "super_admin") return { error: "Only the super admin can change an admin's role." };
  const userId = String(formData.get("userId") ?? "");
  const roleId = String(formData.get("roleId") ?? "") || null;
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== "admin") return { error: "Admin user not found." };
  if (roleId) {
    const role = await db.adminRole.findUnique({ where: { id: roleId } });
    if (!role) return { error: "That role no longer exists." };
  }
  await db.user.update({ where: { id: userId }, data: { adminRoleId: roleId } });
  // Clear legacy per-user permissions; the role is now the source of truth.
  await db.adminPermission.deleteMany({ where: { userId } });
  revalidatePath("/admin/admins");
  return { ok: true };
}

// ---------- Consultants ----------

// Account management scoped to the consultant group (so a sub-admin with only
// the Consultants area can manage consultant accounts without full user access).
export async function setConsultantAccountStatusAction(userId: string, status: "active" | "suspended") {
  await requireAdminArea("admin.consultants");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== "consultant") return;
  await db.user.update({ where: { id: userId }, data: { status } });
  revalidatePath("/admin/consultants");
}

export async function deleteConsultantAccountAction(userId: string) {
  await requireAdminArea("admin.consultants");
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target || target.role !== "consultant") return;
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin/consultants");
}

export async function reviewConsultantAction(profileId: string, approve: boolean, reason = "") {
  const admin = await requireAdminArea("admin.consultants");
  const profile = await db.consultantProfile.update({
    where: { id: profileId },
    data: approve
      ? { status: "approved", approvedById: admin.id, approvedAt: new Date(), rejectionReason: "" }
      : { status: "rejected", rejectionReason: reason },
  });
  await db.notification.create({
    data: {
      userId: profile.userId,
      kind: "info",
      title: approve ? "Your consultant account is approved" : "Your consultant application was not approved",
      body: approve ? "You can now be assigned clients." : reason || "Contact support for details.",
      link: "/consultant",
    },
  });
  revalidatePath("/admin/consultants");
}

// ---------- Assignments (admin proposes; both parties must consent) ----------

export async function proposeAssignmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdminArea("admin.assignments");
  const userId = String(formData.get("userId") ?? "");
  const consultantId = String(formData.get("consultantId") ?? "");
  const caseId = String(formData.get("caseId") ?? "") || null;
  const note = String(formData.get("note") ?? "");
  if (!userId || !consultantId) return { error: "Choose both a user and a consultant." };

  const consultant = await db.consultantProfile.findUnique({ where: { userId: consultantId } });
  if (!consultant || consultant.status !== "approved") return { error: "That consultant is not approved." };

  const assignment = await db.consultantAssignment.create({
    data: { userId, consultantId, caseId, note, assignedById: admin.id },
  });
  await db.notification.create({
    data: {
      userId,
      kind: "assignment",
      title: "A tax consultant has been recommended for you",
      body: "Review the consultant and accept the connection agreement if you'd like their help.",
      link: "/app/consultants",
    },
  });
  await db.notification.create({
    data: {
      userId: consultantId,
      kind: "assignment",
      title: "You have a proposed client assignment",
      body: note || "Review and accept the connection agreement.",
      link: "/consultant",
    },
  });
  revalidatePath("/admin/assignments");
  return { ok: !!assignment };
}

export async function revokeAssignmentAction(id: string) {
  await requireAdminArea("admin.assignments");
  await db.consultantAssignment.update({ where: { id }, data: { status: "revoked" } });
  revalidatePath("/admin/assignments");
}

// ---------- Knowledge base ----------

export async function saveKnowledgeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.knowledge");
  const id = String(formData.get("id") ?? "");
  const data = {
    title: String(formData.get("title") ?? "").trim(),
    sourceType: String(formData.get("sourceType") ?? "publication"),
    reference: String(formData.get("reference") ?? ""),
    url: String(formData.get("url") ?? ""),
    content: String(formData.get("content") ?? ""),
    tags: String(formData.get("tags") ?? ""),
    taxYear: Number(formData.get("taxYear") ?? 0) || null,
    isActive: formData.get("isActive") === "on",
  };
  if (!data.title) return { error: "Title is required." };
  if (id) await db.knowledgeSource.update({ where: { id }, data });
  else await db.knowledgeSource.create({ data });
  revalidatePath("/admin/knowledge");
  return { ok: true };
}

export async function deleteKnowledgeAction(id: string) {
  await requireAdminArea("admin.knowledge");
  await db.knowledgeSource.delete({ where: { id } });
  revalidatePath("/admin/knowledge");
}

// ---------- IRS form templates ----------

export async function saveFormTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.forms");
  const id = String(formData.get("id") ?? "");
  const stepsJson = String(formData.get("stepsJson") ?? "[]");
  try {
    JSON.parse(stepsJson);
  } catch {
    return { error: "Wizard steps must be valid JSON." };
  }
  const data = {
    formNumber: String(formData.get("formNumber") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? ""),
    category: String(formData.get("category") ?? "individual"),
    stepsJson,
    outputTemplate: String(formData.get("outputTemplate") ?? ""),
    isPublished: formData.get("isPublished") === "on",
    requiredFeature: String(formData.get("requiredFeature") ?? ""),
    sortOrder: Number(formData.get("sortOrder") ?? 0) || 0,
  };
  if (!data.formNumber || !data.title) return { error: "Form number and title are required." };
  if (id) await db.irsFormTemplate.update({ where: { id }, data });
  else await db.irsFormTemplate.create({ data });
  revalidatePath("/admin/forms");
  return { ok: true };
}

export async function deleteFormTemplateAction(id: string) {
  await requireAdminArea("admin.forms");
  await db.irsFormTemplate.delete({ where: { id } });
  revalidatePath("/admin/forms");
}
