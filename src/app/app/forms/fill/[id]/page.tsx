import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, ProgressBar } from "@/components/ui";
import { FormStep } from "@/components/form-wizard";
import type { WizardStep } from "@/actions/forms";

export default async function FillFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string; done?: string }>;
}) {
  const { id } = await params;
  const { step: stepParam, done } = await searchParams;
  const user = await requireUser();
  const submission = await db.formSubmission.findFirst({
    where: { id, userId: user.id },
    include: { template: true },
  });
  if (!submission) notFound();

  const steps: WizardStep[] = JSON.parse(submission.template.stepsJson || "[]");
  const data: Record<string, string> = JSON.parse(submission.dataJson || "{}");

  if (done || submission.status === "completed") {
    return (
      <div className="max-w-3xl">
        <PageHeader
          title={`Form ${submission.template.formNumber} — complete`}
          subtitle="Here's your regenerated form, assembled from your answers. Review it, print it, and use it with your filing."
        />
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Level complete — every question answered. Nicely done.
        </div>
        <Card>
          <CardBody>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-800">
              {submission.generatedText || "The form output template hasn't been configured yet."}
            </pre>
          </CardBody>
        </Card>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/app/forms/fill/${submission.id}?step=0`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Edit my answers
          </Link>
          <Link href="/app/forms" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Back to forms
          </Link>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          This is a filled worksheet in the standard form&apos;s layout to make official filing easy — always compare against the
          official IRS form before submitting.
        </p>
      </div>
    );
  }

  const stepIndex = Math.min(Math.max(Number(stepParam ?? 0) || 0, 0), steps.length - 1);
  const step = steps[stepIndex];
  if (!step) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Form {submission.template.formNumber} · {submission.template.title}</span>
          <span>Step {stepIndex + 1} of {steps.length}</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={Math.round((stepIndex / Math.max(steps.length, 1)) * 100)} />
        </div>
      </div>
      <FormStep
        submissionId={submission.id}
        stepIndex={stepIndex}
        step={step}
        savedData={data}
        isLast={stepIndex === steps.length - 1}
      />
      {stepIndex > 0 && (
        <div className="mt-4 text-center">
          <Link href={`/app/forms/fill/${submission.id}?step=${stepIndex - 1}`} className="text-sm text-slate-500 hover:text-slate-800">
            ← Back a step
          </Link>
        </div>
      )}
    </div>
  );
}
