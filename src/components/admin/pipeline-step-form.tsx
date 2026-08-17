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
  mode: string;
  routeKey: string;
  promptId: string;
  promptVersion: string;
  schemaVersion: string;
  pipelineVersion: string;
  isConditional: boolean;
  conditionsJson: string;
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
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Execution mode" hint="parallel = isolated same-pass calls; failover = try providers in order">
          <select name="mode" defaultValue={step?.mode ?? "sequential"} className={inputClass}>
            <option value="sequential">sequential</option>
            <option value="parallel">parallel</option>
            <option value="failover">failover</option>
          </select>
        </Field>
        <Field label="Provider route">
          <input name="routeKey" defaultValue={step?.routeKey ?? ""} placeholder="reasoning_primary" className={inputClass} />
        </Field>
        <Field label="Prompt ID">
          <input name="promptId" defaultValue={step?.promptId ?? ""} placeholder="RESP-ANL-v3" className={inputClass} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Prompt version">
          <input name="promptVersion" defaultValue={step?.promptVersion ?? ""} placeholder="3.0" className={inputClass} />
        </Field>
        <Field label="Schema version">
          <input name="schemaVersion" defaultValue={step?.schemaVersion ?? ""} placeholder="3.0" className={inputClass} />
        </Field>
        <Field label="Pipeline version">
          <input name="pipelineVersion" defaultValue={step?.pipelineVersion ?? ""} placeholder="3.0" className={inputClass} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Prompt template" hint="Placeholders: {{input}}, {{prior}}, {{facts}}, {{documents}}, {{knowledge}}, {{goal}}">
          <textarea name="promptTemplate" defaultValue={step?.promptTemplate} required rows={8} className={`${inputClass} font-mono text-xs`} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Conditional execution rules" hint="JSON array of trigger names. Conditional steps run when the stage requires a reviewer or when no earlier step succeeded.">
          <textarea name="conditionsJson" defaultValue={step?.conditionsJson ?? "[]"} rows={2} className={`${inputClass} font-mono text-xs`} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isEnabled" defaultChecked={step?.isEnabled ?? true} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isConditional" defaultChecked={step?.isConditional ?? false} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            Conditional
          </label>
        </div>
        <SubmitButton>{step ? "Save step" : "Add step"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
