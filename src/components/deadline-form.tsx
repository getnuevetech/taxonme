"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { addDeadlineAction } from "@/actions/user";
import { inputClass } from "./ui";

export function AddDeadlineForm() {
  return (
    <ActionForm action={addDeadlineAction} successMessage="Deadline added.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">What&apos;s due?</span>
          <input name="title" required placeholder="e.g. Respond to CP2000" className={inputClass} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-600">Date</span>
          <input name="dueDate" type="date" required className={inputClass} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-600">Remind me (days before)</span>
          <input name="remindDaysBefore" type="number" defaultValue={7} min={1} max={60} className={inputClass} />
        </label>
        <SubmitButton>Add</SubmitButton>
      </div>
    </ActionForm>
  );
}
