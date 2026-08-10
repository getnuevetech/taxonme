"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { savePipelineStepAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";
import { STEP_ROLES } from "@/lib/constants";

type Step = {
  id: string;
  providerId: string;
  role: string;
  promptTemplate: string;
  sortOrder: number;
  isEnabled: boolean;
} | null;

export function PipelineStepForm({
  stageKey,
  providers,
  step,
}: {
  stageKey: string;
  providers: { id: string; name: string }[];
  step: Step;
}) {
  return (
    <ActionForm action={savePipelineStepAction} successMessage="Step saved.">
      {step && <input type="hidden" name="id" value={step.id} />}
      <input type="hidden" name="stageKey" value={stageKey} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="AI provider">
          <select name="providerId" defaultValue={step?.providerId ?? ""} required className={inputClass}>
            <option value="">Choose…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Responsibility" hint="Each model gets one job — extractor, interpreter, skeptic…">
          <select name="role" defaultValue={step?.role ?? "analyst"} className={inputClass}>
            {Object.values(STEP_ROLES).map((r) => (
              <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Field>
        <Field label="Order">
          <input name="sortOrder" type="number" defaultValue={step?.sortOrder ?? 0} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Prompt template" hint="Placeholders: {{input}}, {{prior}}, {{facts}}, {{documents}}, {{knowledge}}, {{goal}}">
          <textarea name="promptTemplate" defaultValue={step?.promptTemplate} required rows={8} className={`${inputClass} font-mono text-xs`} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isEnabled" defaultChecked={step?.isEnabled ?? true} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          Enabled
        </label>
        <SubmitButton>{step ? "Save step" : "Add step"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
