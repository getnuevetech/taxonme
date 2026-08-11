"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { proposeAssignmentAction, saveSettingsAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";

export function AutoAssignToggle({ enabled }: { enabled: boolean }) {
  return (
    <ActionForm action={saveSettingsAction} successMessage="Auto-assignment setting saved.">
      <div className="flex items-center gap-3">
        <input type="hidden" name="setting:consultants.auto_assign_enabled" value="false" />
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="setting:consultants.auto_assign_enabled"
            value="true"
            defaultChecked={enabled}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600"
          />
          Enable AI auto-assignment of consultants
        </label>
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AssignmentForm({
  users,
  consultants,
}: {
  users: { id: string; label: string }[];
  consultants: { id: string; label: string }[];
}) {
  return (
    <ActionForm action={proposeAssignmentAction} successMessage="Assignment proposed — both parties have been notified.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="User (client)">
          <select name="userId" required className={inputClass}>
            <option value="">Choose a user…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </Field>
        <Field label="Consultant">
          <select name="consultantId" required className={inputClass}>
            <option value="">Choose a consultant…</option>
            {consultants.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field
          label="Note to both parties (optional)"
          hint="Leave blank and the AI matching engine writes the recommendation (a one-line reason plus a detailed outline of why this consultant fits) for both parties."
        >
          <input name="note" placeholder="Leave blank for an AI-written recommendation" className={inputClass} />
        </Field>
      </div>
      <div className="mt-4"><SubmitButton>Propose assignment</SubmitButton></div>
    </ActionForm>
  );
}
