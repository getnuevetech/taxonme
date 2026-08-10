"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { proposeAssignmentAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";

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
        <Field label="Note to both parties (optional)">
          <input name="note" placeholder="Why this consultant fits the user's situation" className={inputClass} />
        </Field>
      </div>
      <div className="mt-4"><SubmitButton>Propose assignment</SubmitButton></div>
    </ActionForm>
  );
}
