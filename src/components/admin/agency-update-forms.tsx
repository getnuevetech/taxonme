"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveAgencyUpdateAction, syncUscisUpdatesAction, toggleAgencyUpdateAction } from "@/actions/admin-updates";
import { Field, inputClass } from "../ui";

export function SyncUscisButton() {
  return (
    <ActionForm action={syncUscisUpdatesAction} successMessage="USCIS sync finished.">
      <SubmitButton>Sync from USCIS now</SubmitButton>
    </ActionForm>
  );
}

export function AgencyUpdateForm({
  update,
}: {
  update: {
    id: string;
    title: string;
    summary: string;
    body: string;
    sourceUrl: string;
    sourceAgency: string;
    isPublished: boolean;
  } | null;
}) {
  return (
    <ActionForm action={saveAgencyUpdateAction} successMessage="Update saved.">
      {update && <input type="hidden" name="id" value={update.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title">
          <input name="title" defaultValue={update?.title} required className={inputClass} />
        </Field>
        <Field label="Agency">
          <input name="sourceAgency" defaultValue={update?.sourceAgency ?? "USCIS"} className={inputClass} />
        </Field>
        <Field label="Source URL">
          <input name="sourceUrl" defaultValue={update?.sourceUrl} className={inputClass} />
        </Field>
        <Field label="Published">
          <select name="isPublished" defaultValue={update?.isPublished === false ? "false" : "true"} className={inputClass}>
            <option value="true">Published</option>
            <option value="false">Draft</option>
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Summary">
          <textarea name="summary" defaultValue={update?.summary} rows={2} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Body">
          <textarea name="body" defaultValue={update?.body} rows={6} className={inputClass} />
        </Field>
      </div>
      <div className="mt-4">
        <SubmitButton>{update ? "Save update" : "Add update"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ToggleAgencyUpdateButton({ id, isPublished }: { id: string; isPublished: boolean }) {
  return (
    <ActionForm action={toggleAgencyUpdateAction} successMessage="Visibility updated.">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="isPublished" value={isPublished ? "false" : "true"} />
      <SubmitButton className="!bg-white !px-3 !py-1.5 !text-xs !text-slate-700 !shadow-none ring-1 ring-slate-300 hover:!bg-slate-50">
        {isPublished ? "Unpublish" : "Publish"}
      </SubmitButton>
    </ActionForm>
  );
}
