"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { generateLetterAction, updateLetterAction } from "@/actions/user";
import { Field, inputClass } from "./ui";

export function NewLetterForm({
  notices,
  defaultNoticeId,
}: {
  notices: { id: string; label: string }[];
  defaultNoticeId: string;
}) {
  return (
    <ActionForm action={generateLetterAction}>
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {notices.length > 0 && (
          <Field label="Related IRS notice (optional)">
            <select name="noticeId" defaultValue={defaultNoticeId} className={inputClass}>
              <option value="">Not related to a specific notice</option>
              {notices.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="What should the letter address?" hint="Explain your side of the story — what you dispute, what you're requesting, and any facts that support you.">
          <textarea name="context" rows={6} required className={inputClass} placeholder="I want to dispute the proposed amount because my employer issued a corrected W-2 in March…" />
        </Field>
        <SubmitButton className="w-full py-3">Generate my draft →</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function EditLetterForm({
  letter,
}: {
  letter: { id: string; title: string; body: string; status: string };
}) {
  return (
    <ActionForm action={updateLetterAction} successMessage="Letter saved.">
      <input type="hidden" name="id" value={letter.id} />
      <div className="space-y-4">
        <input name="title" defaultValue={letter.title} className={inputClass} />
        <textarea
          name="body"
          defaultValue={letter.body}
          rows={22}
          className={`${inputClass} font-mono text-xs leading-relaxed`}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <select name="status" defaultValue={letter.status} className={`${inputClass} !w-auto`}>
              <option value="draft">Draft</option>
              <option value="final">Final — ready to mail</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Print
            </button>
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
