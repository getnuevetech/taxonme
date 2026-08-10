"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { createAdminAction, updateAdminAreasAction } from "@/actions/admin";
import { inputClass } from "../ui";
import { ADMIN_AREAS } from "@/lib/constants";

export function AdminRoleForms({
  mode,
  userId,
  currentAreas,
}: {
  mode: "create" | "edit";
  userId: string;
  currentAreas: string[];
}) {
  const areaPicker = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {ADMIN_AREAS.map((a) => (
        <label key={a.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-checked:border-indigo-400 has-checked:bg-indigo-50">
          <input
            type="checkbox"
            name="areas"
            value={a.key}
            defaultChecked={currentAreas.includes(a.key)}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
          />
          {a.name}
        </label>
      ))}
    </div>
  );

  if (mode === "edit") {
    return (
      <ActionForm action={updateAdminAreasAction} successMessage="Permissions updated.">
        <input type="hidden" name="userId" value={userId} />
        {areaPicker}
        <div className="mt-3"><SubmitButton>Save permissions</SubmitButton></div>
      </ActionForm>
    );
  }

  return (
    <ActionForm action={createAdminAction} successMessage="Admin created.">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="firstName" placeholder="First name" className={inputClass} />
        <input name="lastName" placeholder="Last name" className={inputClass} />
        <input name="email" type="email" required placeholder="Email" className={inputClass} />
        <input name="password" type="password" required placeholder="Password (8+ chars)" className={inputClass} />
      </div>
      <p className="mb-2 mt-4 text-sm font-medium text-slate-700">Which areas can this admin manage?</p>
      {areaPicker}
      <div className="mt-4"><SubmitButton>Create admin</SubmitButton></div>
    </ActionForm>
  );
}
