"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "../action-form";
import { saveApprovalCriteriaAction } from "@/actions/admin";
import { inputClass } from "../ui";

type Criterion = { key: string; name: string; description: string; hasValue: boolean };

export function ApprovalCriteriaForm({
  criteria,
  enabled,
  required,
  minYears,
}: {
  criteria: Criterion[];
  enabled: boolean;
  required: string[];
  minYears: number;
}) {
  const [isEnabled, setIsEnabled] = useState(enabled);

  return (
    <ActionForm action={saveApprovalCriteriaAction} successMessage="Automated approval settings saved.">
      <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <input
          type="checkbox"
          name="enabled"
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.target.checked)}
          className="h-5 w-5 rounded border-slate-300 text-indigo-600"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-900">Enable automated approval</span>
          <span className="block text-xs text-slate-500">
            Applications satisfying every required criterion below are approved instantly; all others wait for manual review.
          </span>
        </span>
      </label>

      <div className={`mt-4 space-y-2 ${isEnabled ? "" : "pointer-events-none opacity-50"}`}>
        {criteria.map((c) => (
          <label key={c.key} className="flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 has-checked:border-indigo-400 has-checked:bg-indigo-50/50">
            <input
              type="checkbox"
              name="criteria"
              value={c.key}
              defaultChecked={required.includes(c.key)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span className="flex-1">
              <span className="block text-sm font-medium text-slate-900">{c.name}</span>
              <span className="block text-xs leading-relaxed text-slate-500">{c.description}</span>
              {c.hasValue && (
                <span className="mt-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                  Minimum years:
                  <input type="number" name="minYears" defaultValue={minYears} min={0} max={50} className={`${inputClass} !w-20 !py-1`} />
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4">
        <SubmitButton>Save approval rules</SubmitButton>
      </div>
    </ActionForm>
  );
}
