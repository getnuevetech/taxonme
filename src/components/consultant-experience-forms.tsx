"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { saveExperiencesAction, addPastCaseAction } from "@/actions/consultant";
import { Field, inputClass } from "./ui";
import { SearchSelect } from "./search-select";
import { CONSULTANT_SPECIALTIES } from "@/lib/constants";
import { recordConsultantExperienceCorrectionAction } from "@/actions/experience-correction";
import { recordGovernmentOutcomeAction } from "@/actions/experience-outcome";
import { GOVERNMENT_SYSTEMS, OUTCOME_KINDS } from "@/lib/experience/outcomes";

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
        <Field label="Year (optional)">
          <SearchSelect
            name="year"
            placeholder="Search year…"
            options={Array.from({ length: 40 }, (_, i) => {
              const y = String(new Date().getFullYear() - i);
              return { value: y, label: y };
            })}
          />
        </Field>
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

export function InstitutionalExperienceForms() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ActionForm
        action={recordConsultantExperienceCorrectionAction}
        successMessage="De-identified correction candidate recorded."
      >
        <h3 className="mb-2 text-sm font-semibold">Correct a reasoning pattern</h3>
        <p className="mb-3 text-xs text-slate-500">
          Use institutional keys only. Do not enter names, account numbers, or
          client narratives.
        </p>
        <div className="space-y-3">
          <Field label="Assigned Situation ID">
            <input name="situationId" required className={inputClass} />
          </Field>
          <input type="hidden" name="failure_type" value="premature_clarification" />
          <Field label="Incorrect key">
            <input name="incorrect_key" required defaultValue="full_form_433_package" className={inputClass} />
          </Field>
          <Field label="Preferred key">
            <input name="preferred_key" required defaultValue="ability_to_pay" className={inputClass} />
          </Field>
          <Field label="Reason key">
            <input name="note_key" required defaultValue="ask_payment_capacity_first" className={inputClass} />
          </Field>
          <SubmitButton>Record correction</SubmitButton>
        </div>
      </ActionForm>

      <ActionForm
        action={recordGovernmentOutcomeAction}
        successMessage="Authority-checked outcome candidate recorded."
      >
        <h3 className="mb-2 text-sm font-semibold">Record a tax outcome</h3>
        <p className="mb-3 text-xs text-slate-500">
          Outcomes are historical experience, not law. Cite an institutional
          IRS, state DOR, or Tax Court authority key.
        </p>
        <div className="space-y-3">
          <Field label="Assigned Situation ID">
            <input name="situationId" required className={inputClass} />
          </Field>
          <Field label="Outcome">
            <select name="outcome_kind" className={inputClass}>
              {OUTCOME_KINDS.map((kind) => (
                <option key={kind} value={kind}>{kind.replaceAll("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Government system">
            <select name="government_system" className={inputClass}>
              {GOVERNMENT_SYSTEMS.map((system) => (
                <option key={system} value={system}>{system.replaceAll("_", " ")}</option>
              ))}
            </select>
          </Field>
          <Field label="Form or notice key">
            <input name="form_or_notice_key" required defaultValue="cp503" className={inputClass} />
          </Field>
          <Field label="Authority keys" hint="Comma-separated institutional catalog keys.">
            <input name="authority_keys" required defaultValue="irs_collection_process" className={inputClass} />
          </Field>
          <Field label="Authority publisher">
            <select name="authority_publisher" className={inputClass}>
              <option value="IRS">IRS</option>
              <option value="STATE_DOR">State DOR</option>
              <option value="TAX_COURT">Tax Court</option>
            </select>
          </Field>
          <Field label="Outcome note key">
            <input name="note_key" required defaultValue="notice_resolved" className={inputClass} />
          </Field>
          <SubmitButton>Record outcome</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
