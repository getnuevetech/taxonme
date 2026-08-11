"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "../action-form";
import { saveMessageTemplateAction, pushMessageAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";

type Template = {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
  kind: string;
  offsetDays: number | null;
  enabled: boolean;
} | null;

export function MessageTemplateForm({ template }: { template: Template }) {
  const [kind, setKind] = useState(template?.kind ?? "custom");
  return (
    <ActionForm action={saveMessageTemplateAction} successMessage="Message saved.">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Key" hint="Stable identifier (letters, numbers, _).">
          <input name="key" defaultValue={template?.key} required readOnly={!!template} className={`${inputClass} ${template ? "bg-slate-50 text-slate-500" : ""}`} />
        </Field>
        <Field label="Name">
          <input name="name" defaultValue={template?.name} required className={inputClass} />
        </Field>
        <Field label="Type">
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
            <option value="event">Event (sent on activity)</option>
            <option value="scheduled">Scheduled (relative to expiration)</option>
            <option value="custom">Custom (manual push)</option>
          </select>
        </Field>
        {kind === "scheduled" && (
          <Field label="Days offset" hint="Negative = before expiration, 0 = on expiry, positive = after.">
            <input name="offsetDays" type="number" defaultValue={template?.offsetDays ?? -7} className={inputClass} />
          </Field>
        )}
      </div>
      <div className="mt-3">
        <Field label="Email subject">
          <input name="subject" defaultValue={template?.subject} required className={inputClass} />
        </Field>
      </div>
      <div className="mt-3">
        <Field
          label="Message body (HTML)"
          hint="HTML formatting supported. Placeholders: {{firstName}} {{lastName}} {{email}} {{appName}} {{appUrl}} {{planName}} {{expiresOn}} {{link}}"
        >
          <textarea name="bodyHtml" defaultValue={template?.bodyHtml} rows={10} className={`${inputClass} font-mono text-xs`} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="enabled" defaultChecked={template?.enabled ?? true} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          Enabled
        </label>
        <SubmitButton>{template ? "Save message" : "Create message"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PushMessageForm({ templates }: { templates: { key: string; name: string }[] }) {
  return (
    <ActionForm action={pushMessageAction} successMessage="Message pushed.">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56">
          <span className="mb-1 block text-xs font-medium text-slate-600">Message</span>
          <select name="templateKey" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose a message…</option>
            {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </label>
        <label className="min-w-64 flex-1">
          <span className="mb-1 block text-xs font-medium text-slate-600">Recipient email (customer or consultant)</span>
          <input name="email" type="email" required placeholder="customer@example.com" className={inputClass} />
        </label>
        <SubmitButton>Send message</SubmitButton>
      </div>
    </ActionForm>
  );
}
