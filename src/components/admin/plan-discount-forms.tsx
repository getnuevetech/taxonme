"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "../action-form";
import { savePlanDiscountAction, deletePlanDiscountAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";

export type DiscountRow = {
  id: string;
  planId: string;
  name: string;
  percentOff: number;
  amountOffCents: number;
  audience: string;
  emails: string[];
  startsAt: string | null; // yyyy-mm-dd
  endsAt: string | null;
  isActive: boolean;
};

export function PlanDiscountForm({ planId, discount }: { planId: string; discount: DiscountRow | null }) {
  const [audience, setAudience] = useState(discount?.audience ?? "all");
  return (
    <ActionForm action={savePlanDiscountAction} successMessage="Discount saved.">
      {discount && <input type="hidden" name="id" value={discount.id} />}
      <input type="hidden" name="planId" value={planId} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Name (customers see this)">
          <input name="name" defaultValue={discount?.name} required placeholder="Launch sale" className={inputClass} />
        </Field>
        <Field label="Percent off (1–100)">
          <input name="percentOff" type="number" min={0} max={100} defaultValue={discount?.percentOff || ""} className={inputClass} />
        </Field>
        <Field label="…or fixed $ off">
          <input name="amountOff" type="number" min={0} step="0.01" defaultValue={discount && discount.amountOffCents ? discount.amountOffCents / 100 : ""} className={inputClass} />
        </Field>
        <Field label="Who gets it">
          <select name="audience" value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass}>
            <option value="all">Everyone (general sale)</option>
            <option value="specific">Specific people (by email)</option>
          </select>
        </Field>
      </div>
      {audience === "specific" && (
        <div className="mt-3">
          <Field label="Emails" hint="One per line (or comma-separated). Only these accounts see and receive the discount.">
            <textarea name="emails" defaultValue={discount?.emails.join("\n")} rows={3} className={inputClass} />
          </Field>
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Starts (optional)">
          <input name="startsAt" type="date" defaultValue={discount?.startsAt ?? ""} className={inputClass} />
        </Field>
        <Field label="Ends (optional)">
          <input name="endsAt" type="date" defaultValue={discount?.endsAt ?? ""} className={inputClass} />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={discount?.isActive ?? true} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          Active
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <SubmitButton>{discount ? "Save discount" : "Create discount"}</SubmitButton>
        {discount && (
          <button
            formAction={() => deletePlanDiscountAction(discount.id)}
            className="text-xs font-medium text-red-500 hover:text-red-700"
          >
            Delete discount
          </button>
        )}
      </div>
    </ActionForm>
  );
}
