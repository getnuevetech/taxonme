"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveSettingsAction, addSettingAction } from "@/actions/admin";
import { inputClass } from "../ui";

export function SettingsForm({
  settings,
}: {
  settings: { key: string; value: string; label: string; type: string; description: string }[];
}) {
  return (
    <ActionForm action={saveSettingsAction} successMessage="Settings saved.">
      <div className="space-y-4">
        {settings.map((s) => (
          <label key={s.key} className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{s.label}</span>
            {s.type === "boolean" ? (
              <select name={`setting:${s.key}`} defaultValue={s.value} className={`${inputClass} !w-40`}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            ) : s.value.length > 80 || s.type === "json" ? (
              <textarea name={`setting:${s.key}`} defaultValue={s.value} rows={3} className={inputClass} />
            ) : (
              <input
                name={`setting:${s.key}`}
                type={s.type === "secret" ? "password" : s.type === "number" ? "number" : "text"}
                defaultValue={s.value}
                className={inputClass}
              />
            )}
            <span className="mt-0.5 block text-xs text-slate-400">{s.description || s.key}</span>
          </label>
        ))}
      </div>
      <div className="mt-4"><SubmitButton>Save settings</SubmitButton></div>
    </ActionForm>
  );
}

export function AddSettingForm() {
  return (
    <ActionForm action={addSettingAction} successMessage="Setting added.">
      <div className="grid gap-3 sm:grid-cols-5">
        <input name="key" required placeholder="key (e.g. app.support_email)" className={inputClass} />
        <input name="label" placeholder="Label" className={inputClass} />
        <input name="value" placeholder="Value" className={inputClass} />
        <input name="group" placeholder="Group (e.g. general)" className={inputClass} />
        <select name="type" className={inputClass}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
          <option value="json">JSON</option>
          <option value="secret">Secret</option>
        </select>
      </div>
      <div className="mt-3"><SubmitButton>Add setting</SubmitButton></div>
    </ActionForm>
  );
}
