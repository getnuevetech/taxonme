"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveFormStepAction, type WizardStep } from "@/actions/forms";
import { inputClass } from "./ui";

function Submit({ isLast }: { isLast: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : isLast ? "Finish & build my form ✓" : "Next →"}
    </button>
  );
}

export function FormStep({
  submissionId,
  stepIndex,
  step,
  savedData,
  isLast,
}: {
  submissionId: string;
  stepIndex: number;
  step: WizardStep;
  savedData: Record<string, string>;
  isLast: boolean;
}) {
  const [state, formAction] = useActionState(saveFormStepAction, null);

  return (
    <form action={formAction} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <input type="hidden" name="submissionId" value={submissionId} />
      <input type="hidden" name="stepIndex" value={stepIndex} />
      <h2 className="text-2xl font-bold text-slate-900">{step.title}</h2>
      {step.help && <p className="mt-1 text-sm text-slate-500">{step.help}</p>}
      {state?.error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <div className="mt-6 space-y-5">
        {step.fields.map((field) => {
          const saved = savedData[field.key] ?? "";
          return (
            <label key={field.key} className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-800">
                {field.label}
                {field.required && <span className="text-red-500"> *</span>}
              </span>
              {field.type === "textarea" ? (
                <textarea name={field.key} defaultValue={saved} rows={3} placeholder={field.placeholder} className={inputClass} />
              ) : field.type === "select" ? (
                <select name={field.key} defaultValue={saved} className={inputClass}>
                  <option value="">Choose…</option>
                  {(field.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : field.type === "boolean" ? (
                <div className="flex gap-3">
                  {["Yes", "No"].map((v) => (
                    <label key={v} className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium has-checked:border-indigo-500 has-checked:bg-indigo-50">
                      <input type="radio" name={field.key} value={v} defaultChecked={saved === v} className="h-4 w-4 text-indigo-600" />
                      {v}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  name={field.key}
                  type={field.type === "money" || field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  step={field.type === "money" ? "0.01" : undefined}
                  defaultValue={saved}
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              )}
              {field.hint && <span className="mt-1 block text-xs text-slate-400">{field.hint}</span>}
            </label>
          );
        })}
      </div>
      <div className="mt-8">
        <Submit isLast={isLast} />
      </div>
    </form>
  );
}
