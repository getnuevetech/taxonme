"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "./action-form";
import { createTicketAction, replyTicketAction, adminReplyTicketAction, rateTicketAction } from "@/actions/support";
import { Field, inputClass } from "./ui";

const fileInputClass =
  "text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200";

export function NewTicketForm({
  defaultCategory,
  defaultSubject,
  fromChatbot,
}: {
  defaultCategory: string;
  defaultSubject: string;
  fromChatbot: boolean;
}) {
  return (
    <ActionForm action={createTicketAction}>
      {fromChatbot && <input type="hidden" name="source" value="chatbot" />}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Field label="What kind of issue is this?">
          <select name="category" defaultValue={defaultCategory} className={inputClass}>
            <option value="customer_service">Customer service — billing, account, general help</option>
            <option value="tech_support">Tech support — errors, bugs, something not working</option>
          </select>
        </Field>
        <Field label="Subject">
          <input name="subject" defaultValue={defaultSubject} required placeholder="Short summary of the issue" className={inputClass} />
        </Field>
        <Field label="Describe the issue" hint="Include what you were doing, what you expected, and what happened instead.">
          <textarea name="body" rows={6} required className={inputClass} />
        </Field>
        <Field label="Attachments (optional)" hint="Screenshots or files that help explain the issue. Up to 5 files, 10 MB each.">
          <input type="file" name="files" multiple className={fileInputClass} />
        </Field>
        <SubmitButton className="w-full py-3">Submit ticket →</SubmitButton>
      </div>
    </ActionForm>
  );
}

type Canned = { id: string; title: string; body: string; category: string };

export function TicketReplyForm({
  ticketId,
  staff,
  canned = [],
  category = "all",
}: {
  ticketId: string;
  staff: boolean;
  canned?: Canned[];
  category?: string;
}) {
  const [body, setBody] = useState("");
  const relevant = canned.filter((c) => c.category === "all" || c.category === category);

  return (
    <ActionForm action={staff ? adminReplyTicketAction : replyTicketAction} successMessage="Sent.">
      <input type="hidden" name="ticketId" value={ticketId} />
      {staff && relevant.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const c = relevant.find((x) => x.id === e.target.value);
            if (c) setBody((prev) => (prev ? `${prev}\n${c.body}` : c.body));
          }}
          className={`${inputClass} mb-2 !w-auto text-xs`}
        >
          <option value="" disabled>Insert canned response…</option>
          {relevant.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      )}
      <div className="flex items-start gap-2">
        <textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={staff ? 3 : 2}
          placeholder={staff ? "Reply to the user, or add an internal note…" : "Type your reply…"}
          className={inputClass}
        />
        <SubmitButton>Send</SubmitButton>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <input type="file" name="files" multiple className={fileInputClass} />
        {staff && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" name="internal" className="h-4 w-4 rounded border-slate-300 text-amber-600" />
            Internal note — visible to staff only, the user is not notified
          </label>
        )}
      </div>
    </ActionForm>
  );
}

// Customer satisfaction rating shown once a ticket is resolved.
export function RateTicket({ ticketId }: { ticketId: string }) {
  const [rating, setRating] = useState(0);
  return (
    <ActionForm action={rateTicketAction} successMessage="Thanks for your feedback!">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="rating" value={rating} />
      <p className="text-sm font-semibold text-slate-900">How did we do?</p>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={`text-2xl transition ${n <= rating ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input name="comment" placeholder="Anything we could do better? (optional)" className={inputClass} />
        <SubmitButton>Rate</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AttachmentList({
  attachments,
  light,
}: {
  attachments: { id: string; fileName: string }[];
  light?: boolean;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-2 space-y-0.5">
      {attachments.map((a) => (
        <a
          key={a.id}
          href={`/api/tickets/files/${a.id}`}
          target="_blank"
          className={`block truncate text-xs underline ${light ? "text-indigo-100" : "text-indigo-600"}`}
        >
          📎 {a.fileName}
        </a>
      ))}
    </div>
  );
}
