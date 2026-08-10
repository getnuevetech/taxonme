"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveContentPageAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";

type Page = {
  id: string;
  slug: string;
  title: string;
  body: string;
  kind: string;
  audience: string;
  isPublished: boolean;
} | null;

const KINDS = [
  { value: "page", label: "Page" },
  { value: "blog", label: "Blog post" },
  { value: "terms", label: "Terms of service" },
  { value: "privacy", label: "Privacy policy" },
  { value: "policy", label: "Policy" },
  { value: "legal", label: "Legal" },
  { value: "agreement_user", label: "Agreement — regular users" },
  { value: "agreement_consultant", label: "Agreement — consultants" },
  { value: "agreement_connection", label: "Agreement — user ↔ consultant connection" },
];

export function ContentPageForm({ page }: { page: Page }) {
  return (
    <ActionForm action={saveContentPageAction} successMessage="Page saved.">
      {page && <input type="hidden" name="id" value={page.id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Title"><input name="title" defaultValue={page?.title} required className={inputClass} /></Field>
        <Field label="Slug"><input name="slug" defaultValue={page?.slug} required placeholder="terms-of-service" className={inputClass} /></Field>
        <Field label="Kind">
          <select name="kind" defaultValue={page?.kind ?? "page"} className={inputClass}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </Field>
        <Field label="Audience">
          <select name="audience" defaultValue={page?.audience ?? "all"} className={inputClass}>
            <option value="all">Everyone</option>
            <option value="user">Regular users</option>
            <option value="consultant">Consultants</option>
            <option value="admin">Admins</option>
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Body">
          <textarea name="body" defaultValue={page?.body} rows={12} className={inputClass} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isPublished" defaultChecked={page?.isPublished ?? false} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            Published
          </label>
          {page && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="bumpVersion" className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
              Bump version (users must re-accept agreements)
            </label>
          )}
        </div>
        <SubmitButton>{page ? "Save page" : "Create page"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
