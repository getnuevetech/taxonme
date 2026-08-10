"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import type { ActionState } from "./auth";

export type WizardStep = {
  id: string;
  title: string;
  help: string;
  fields: {
    key: string;
    label: string;
    type: "text" | "number" | "money" | "date" | "select" | "boolean" | "textarea";
    options?: { value: string; label: string }[];
    placeholder?: string;
    required?: boolean;
    hint?: string;
  }[];
};

export async function startFormAction(templateId: string) {
  const user = await requireUser();
  const template = await db.irsFormTemplate.findUnique({ where: { id: templateId } });
  if (!template || !template.isPublished) return;
  if (template.requiredFeature && !(await hasFeature(user.id, template.requiredFeature))) {
    redirect("/app/billing?upgrade=forms");
  }
  const existing = await db.formSubmission.findFirst({
    where: { userId: user.id, templateId, status: "in_progress" },
  });
  const submission =
    existing ??
    (await db.formSubmission.create({ data: { userId: user.id, templateId } }));
  redirect(`/app/forms/fill/${submission.id}`);
}

export async function saveFormStepAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const submissionId = String(formData.get("submissionId") ?? "");
  const stepIndex = Number(formData.get("stepIndex") ?? 0);
  const submission = await db.formSubmission.findUnique({
    where: { id: submissionId },
    include: { template: true },
  });
  if (!submission || submission.userId !== user.id) return { error: "Not found." };

  const steps: WizardStep[] = JSON.parse(submission.template.stepsJson || "[]");
  const step = steps[stepIndex];
  if (!step) return { error: "Invalid step." };

  const data: Record<string, string> = JSON.parse(submission.dataJson || "{}");
  for (const field of step.fields) {
    const value = String(formData.get(field.key) ?? "");
    if (field.required && !value) return { error: `${field.label} is required.` };
    data[field.key] = value;
  }

  const nextIndex = stepIndex + 1;
  const done = nextIndex >= steps.length;
  const progressPct = Math.round(((done ? steps.length : nextIndex) / Math.max(steps.length, 1)) * 100);

  let generatedText = submission.generatedText;
  if (done) {
    // Regenerate the standard-form layout from the simplified answers.
    generatedText = submission.template.outputTemplate.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
      const v = data[k];
      return v === undefined || v === "" ? "____________" : v;
    });
  }

  await db.formSubmission.update({
    where: { id: submissionId },
    data: {
      dataJson: JSON.stringify(data),
      progressPct,
      status: done ? "completed" : "in_progress",
      generatedText,
    },
  });

  if (done) redirect(`/app/forms/fill/${submissionId}?done=1`);
  redirect(`/app/forms/fill/${submissionId}?step=${nextIndex}`);
}

export async function deleteFormSubmissionAction(id: string) {
  const user = await requireUser();
  await db.formSubmission.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/app/forms");
}
