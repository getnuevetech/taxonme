"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveSettingsAction } from "@/actions/admin";

export function PaidDownloadsToggle({ paid }: { paid: boolean }) {
  return (
    <ActionForm action={saveSettingsAction} successMessage="Download setting saved.">
      <div className="flex items-center gap-3">
        <input type="hidden" name="setting:forms.paid_downloads" value="false" />
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="setting:forms.paid_downloads"
            value="true"
            defaultChecked={paid}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600"
          />
          Completed form downloads are a paid feature
        </label>
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
