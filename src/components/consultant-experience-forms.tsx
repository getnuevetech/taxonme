"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { saveExperiencesAction, addPastCaseAction } from "@/actions/consultant";
import { Field, inputClass } from "./ui";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";

export function ExperienceForm({ experiences }: { experiences: string }) {
  return (
    <ActionForm action={saveExperiencesAction} successMessage="Experience saved.">
      <textarea name="experiences" defaultValue={experiences} rows={5} className={inputClass} placeholder={"Negotiated 40+ installment agreements\nCP2000 responses for self-employed clients\nPenalty abatement for first-time offenders"} />
      <div className="mt-3"><SubmitButton>Save experience</SubmitButton></div>
    </ActionForm>
  );
}

export function PastCaseForm() {
  return (
    <ActionForm action={addPastCaseAction} successMessage="Past case added.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" hint="No client names or identifying details.">
          <input name="title" required placeholder="e.g. Resolved $18k balance via installment agreement" className={inputClass} />
        </Field>
        <Field label="Category">
          <select name="category" className={inputClass}>
            {CONSULTANT_SPECIALTIES.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Year (optional)"><input name="year" type="number" min={1990} max={2100} className={inputClass} /></Field>
        <Field label="Outcome (optional)"><input name="outcome" placeholder="e.g. Penalties abated in full" className={inputClass} /></Field>
      </div>
      <div className="mt-3">
        <Field label="Brief description (optional)">
          <textarea name="description" rows={2} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3"><SubmitButton>Add past case</SubmitButton></div>
    </ActionForm>
  );
}
