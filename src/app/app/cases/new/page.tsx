"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { createCaseAction } from "@/actions/case";
import { PageHeader, Field, inputClass } from "@/components/ui";

export default function NewCasePage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Start a new case" subtitle="Tell us what happened and what you want to achieve. We'll do the rest." />
      <ActionForm action={createCaseAction}>
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Field label="What happened?" hint="Your own words are perfect. Mention years, amounts, and any letters you received.">
            <textarea name="situation" rows={6} required className={inputClass} placeholder="I received a CP2000 notice for 2024 saying I owe $2,800…" />
          </Field>
          <Field label="What do you want to achieve?" hint="Your goal shapes the plan we build.">
            <textarea name="goal" rows={3} className={inputClass} placeholder="Understand the notice and set up a payment plan I can afford." />
          </Field>
          <SubmitButton className="w-full py-3">Analyze my situation →</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
