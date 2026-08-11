"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveCannedResponseAction } from "@/actions/support";
import { Field, inputClass } from "../ui";

type Canned = { id: string; title: string; body: string; category: string } | null;

export function CannedResponseForm({ canned }: { canned: Canned }) {
  return (
    <ActionForm action={saveCannedResponseAction} successMessage="Canned response saved.">
      {canned && <input type="hidden" name="id" value={canned.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Title">
          <input name="title" defaultValue={canned?.title} required placeholder="e.g. Password reset steps" className={inputClass} />
        </Field>
        <Field label="Queue">
          <select name="category" defaultValue={canned?.category ?? "all"} className={inputClass}>
            <option value="all">Both queues</option>
            <option value="customer_service">Customer service</option>
            <option value="tech_support">Tech support</option>
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Response text">
          <textarea name="body" defaultValue={canned?.body} required rows={3} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3"><SubmitButton>{canned ? "Save" : "Add canned response"}</SubmitButton></div>
    </ActionForm>
  );
}
