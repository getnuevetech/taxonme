"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdminArea } from "@/lib/auth";
import { syncAgencyUpdates } from "@/lib/agency-updates/sync";
import { slugifyUpdateTitle } from "@/lib/agency-updates/parse";
import type { ActionState } from "./auth";

export async function syncUscisUpdatesAction(prev: ActionState, formData: FormData): Promise<ActionState> {
  void prev;
  void formData;
  await requireAdminArea("admin.content");
  const result = await syncAgencyUpdates();
  revalidatePath("/admin/updates");
  revalidatePath("/updates");
  revalidatePath("/");
  if (result.error && result.upserted === 0) {
    return { error: `Sync could not reach USCIS (${result.error}). Seeded or manually added updates still show on the site.` };
  }
  return { ok: true };
}

export async function saveAgencyUpdateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.content");
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };
  const sourceAgency = String(formData.get("sourceAgency") ?? "USCIS").trim() || "USCIS";
  const summary = String(formData.get("summary") ?? "");
  const body = String(formData.get("body") ?? "");
  const sourceUrl = String(formData.get("sourceUrl") ?? "");
  const isPublished = String(formData.get("isPublished") ?? "true") !== "false";
  const externalId = id ? undefined : `manual:${Date.now()}:${title.slice(0, 40)}`;
  const slug = slugifyUpdateTitle(title, externalId ?? id);

  if (id) {
    await db.agencyUpdate.update({
      where: { id },
      data: { title, summary, body, sourceUrl, sourceAgency, isPublished },
    });
  } else {
    await db.agencyUpdate.create({
      data: {
        slug,
        title,
        summary,
        body,
        sourceUrl,
        sourceAgency,
        externalId: externalId!,
        isPublished,
        publishedAt: new Date(),
        syncedAt: new Date(),
      },
    });
  }
  revalidatePath("/admin/updates");
  revalidatePath("/updates");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleAgencyUpdateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminArea("admin.content");
  const id = String(formData.get("id") ?? "");
  const isPublished = String(formData.get("isPublished") ?? "true") !== "false";
  if (!id) return { error: "Missing update." };
  await db.agencyUpdate.update({ where: { id }, data: { isPublished } });
  revalidatePath("/admin/updates");
  revalidatePath("/updates");
  revalidatePath("/");
  return { ok: true };
}
