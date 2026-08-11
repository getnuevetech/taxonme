"use client";

import { ActionForm, SubmitButton } from "./action-form";
import { createTicketAction, replyTicketAction, adminReplyTicketAction } from "@/actions/support";
import { Field, inputClass } from "./ui";

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
        <SubmitButton className="w-full py-3">Submit ticket →</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function TicketReplyForm({ ticketId, staff }: { ticketId: string; staff: boolean }) {
  return (
    <ActionForm action={staff ? adminReplyTicketAction : replyTicketAction} successMessage="Reply sent.">
      <input type="hidden" name="ticketId" value={ticketId} />
      <div className="flex gap-2">
        <input name="body" placeholder="Type your reply…" autoComplete="off" className={inputClass} />
        <SubmitButton>Reply</SubmitButton>
      </div>
    </ActionForm>
  );
}
