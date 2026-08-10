"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveFormTemplateAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";

type Template = {
  id: string;
  formNumber: string;
  title: string;
  description: string;
  category: string;
  stepsJson: string;
  outputTemplate: string;
  isPublished: boolean;
  requiredFeature: string;
  sortOrder: number;
} | null;

export function FormTemplateForm({
  template,
  features,
}: {
  template: Template;
  features: { key: string; name: string }[];
}) {
  return (
    <ActionForm action={saveFormTemplateAction} successMessage="Template saved.">
      {template && <input type="hidden" name="id" value={template.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Form number"><input name="formNumber" defaultValue={template?.formNumber} required placeholder="1040" className={inputClass} /></Field>
        <Field label="Title"><input name="title" defaultValue={template?.title} required className={inputClass} /></Field>
        <Field label="Category"><input name="category" defaultValue={template?.category ?? "individual"} className={inputClass} /></Field>
        <Field label="Required feature (plan gate)">
          <select name="requiredFeature" defaultValue={template?.requiredFeature ?? ""} className={inputClass}>
            <option value="">Free for everyone</option>
            {features.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Description"><input name="description" defaultValue={template?.description} className={inputClass} /></Field>
      </div>
      <div className="mt-3">
        <Field
          label="Wizard steps (JSON)"
          hint='Array of steps: [{"id":"s1","title":"…","help":"…","fields":[{"key":"first_name","label":"…","type":"text|number|money|date|select|boolean|textarea","required":true,"options":[…],"hint":"…"}]}]'
        >
          <textarea name="stepsJson" defaultValue={template?.stepsJson ?? "[]"} rows={10} className={`${inputClass} font-mono text-xs`} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Output template" hint="The standard-form layout regenerated from answers. Use {{field_key}} placeholders.">
          <textarea name="outputTemplate" defaultValue={template?.outputTemplate} rows={10} className={`${inputClass} font-mono text-xs`} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isPublished" defaultChecked={template?.isPublished ?? false} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            Published
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            Sort <input name="sortOrder" type="number" defaultValue={template?.sortOrder ?? 0} className={`${inputClass} !w-20`} />
          </label>
        </div>
        <SubmitButton>{template ? "Save template" : "Add template"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
