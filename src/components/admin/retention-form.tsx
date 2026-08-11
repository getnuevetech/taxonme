"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveSettingsAction } from "@/actions/admin";
import { inputClass } from "../ui";

export function RetentionForm({ days }: { days: number }) {
  return (
    <ActionForm action={saveSettingsAction} successMessage="Retention period saved.">
      <div className="flex flex-wrap items-end gap-3">
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-600">Days before permanent expunge</span>
          <input
            type="number"
            name="setting:users.deleted_retention_days"
            defaultValue={days}
            min={1}
            max={3650}
            className={`${inputClass} !w-32`}
          />
        </label>
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
