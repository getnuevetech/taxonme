"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { createCaseAction } from "@/actions/case";
import { PageHeader, Field, inputClass } from "@/components/ui";

function NewCaseForm() {
  // The guide chatbot hands off new tax situations here with the user's
  // message pre-filled — the user confirms it as a new case.
  const prefill = useSearchParams().get("prefill") ?? "";
  return (
    <div className="max-w-2xl">
      <PageHeader title="Start a new case" subtitle="Tell us what happened and what you want to achieve. We'll do the rest." />
      {prefill && (
        <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          We carried over what you told the guide — review it, add anything missing, and confirm to open this as a new case.
        </div>
      )}
      <ActionForm action={createCaseAction}>
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Field label="What happened?" hint="Your own words are perfect. Mention years, amounts, filing gaps, and any letters you received.">
            <textarea name="situation" rows={6} required defaultValue={prefill} className={inputClass} placeholder="I have not filed taxes for the past 4 years and want to get back into compliance…" />
          </Field>
          <Field label="What do you want to achieve?" hint="Your goal shapes the plan we build.">
            <textarea name="goal" rows={3} className={inputClass} placeholder="Figure out which years to file first and what documents I need." />
          </Field>
          <SubmitButton className="w-full py-3">Analyze my situation →</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}

export default function NewCasePage() {
  return (
    <Suspense>
      <NewCaseForm />
    </Suspense>
  );
}
