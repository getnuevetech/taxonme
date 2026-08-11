"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { adminCreateTicketAction, assignTicketAgentAction } from "@/actions/support";
import { Field, inputClass } from "../ui";
import { UserSearchPicker } from "./user-search-picker";

type Option = { id: string; label: string };

export function AdminCreateTicketForm({ agents }: { agents: Option[] }) {
  return (
    <ActionForm action={adminCreateTicketAction}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="On behalf of" hint="Type at least 2 characters of their name, email, or mobile.">
          <UserSearchPicker name="userId" />
        </Field>
        <Field label="Queue">
          <select name="category" className={inputClass}>
            <option value="customer_service">Customer service</option>
            <option value="tech_support">Tech support</option>
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue="normal" className={inputClass}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </Field>
        <Field label="Assign to agent (optional)">
          <select name="assignedToId" defaultValue="" className={inputClass}>
            <option value="">Unassigned</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Subject">
          <input name="subject" required placeholder="Short summary of the issue" className={inputClass} />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Issue description" hint="The user is notified and can reply in the ticket thread.">
          <textarea name="body" rows={4} required className={inputClass} />
        </Field>
      </div>
      <div className="mt-4"><SubmitButton>Create ticket</SubmitButton></div>
    </ActionForm>
  );
}

export function AssignAgentForm({
  ticketId,
  currentAgentId,
  agents,
}: {
  ticketId: string;
  currentAgentId: string;
  agents: Option[];
}) {
  return (
    <ActionForm action={assignTicketAgentAction} successMessage="Agent updated." className="flex items-end gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-500">Assigned agent</span>
        <select name="assignedToId" defaultValue={currentAgentId} className={`${inputClass} !w-48`}>
          <option value="">Unassigned</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>
      <SubmitButton className="!py-2">Assign</SubmitButton>
    </ActionForm>
  );
}
