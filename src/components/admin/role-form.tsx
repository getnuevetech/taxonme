"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveAdminRoleAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";
import { ADMIN_AREAS } from "@/lib/constants";

type Role = { id: string; name: string; description: string; areas: string[] } | null;

export function RoleForm({ role }: { role: Role }) {
  return (
    <ActionForm action={saveAdminRoleAction} successMessage="Role saved.">
      {role && <input type="hidden" name="id" value={role.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Role name">
          <input name="name" defaultValue={role?.name} required placeholder="e.g. Finance manager" className={inputClass} />
        </Field>
        <Field label="Description">
          <input name="description" defaultValue={role?.description} placeholder="What this role is for" className={inputClass} />
        </Field>
      </div>
      <p className="mb-2 mt-4 text-sm font-medium text-slate-700">Which admin areas can this role manage?</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ADMIN_AREAS.map((a) => (
          <label key={a.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm has-checked:border-indigo-400 has-checked:bg-indigo-50">
            <input
              type="checkbox"
              name="areas"
              value={a.key}
              defaultChecked={role?.areas.includes(a.key)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            {a.name}
          </label>
        ))}
      </div>
      <div className="mt-4"><SubmitButton>{role ? "Save role" : "Create role"}</SubmitButton></div>
    </ActionForm>
  );
}
