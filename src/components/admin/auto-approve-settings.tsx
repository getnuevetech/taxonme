"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveSettingsAction } from "@/actions/admin";
import { inputClass } from "../ui";

export function AutoApproveSettings({ enabled, minYears }: { enabled: boolean; minYears: number }) {
  return (
    <ActionForm action={saveSettingsAction} successMessage="Approval settings saved.">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="hidden" name="setting:consultants.auto_approve_enabled" value="false" />
          <input
            type="checkbox"
            name="setting:consultants.auto_approve_enabled"
            value="true"
            defaultChecked={enabled}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          Auto-approve CPA/EA applicants with license number + proof
        </label>
        <label className="text-sm text-slate-700">
          <span className="mb-1 block text-xs font-medium text-slate-500">Minimum years of experience</span>
          <input type="number" name="setting:consultants.auto_approve_min_years" defaultValue={minYears} min={0} className={`${inputClass} !w-28`} />
        </label>
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
