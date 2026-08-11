"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { createAdminAction, assignAdminRoleAction } from "@/actions/admin";
import { inputClass } from "../ui";

type RoleOption = { id: string; name: string };

export function CreateAdminForm({ roles }: { roles: RoleOption[] }) {
  return (
    <ActionForm action={createAdminAction} successMessage="Admin created.">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="firstName" placeholder="First name" className={inputClass} />
        <input name="lastName" placeholder="Last name" className={inputClass} />
        <input name="email" type="email" required placeholder="Email" className={inputClass} />
        <input name="password" type="password" required placeholder="Password (8+ chars)" className={inputClass} />
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
        <select name="roleId" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose a role…</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <span className="mt-1 block text-xs text-slate-500">
          The role decides which admin areas this user can manage.
        </span>
      </label>
      <div className="mt-4"><SubmitButton>Create admin</SubmitButton></div>
    </ActionForm>
  );
}

export function AssignRoleForm({
  userId,
  currentRoleId,
  roles,
}: {
  userId: string;
  currentRoleId: string;
  roles: RoleOption[];
}) {
  return (
    <ActionForm action={assignAdminRoleAction} successMessage="Role updated." className="flex items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-500">Assigned role</span>
        <select name="roleId" defaultValue={currentRoleId} className={`${inputClass} !w-52`}>
          <option value="">No role (no access)</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <SubmitButton className="!py-2">Update</SubmitButton>
    </ActionForm>
  );
}
