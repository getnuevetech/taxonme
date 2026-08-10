"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { saveGatewayAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";

type Gateway = {
  id: string;
  name: string;
  kind: string;
  mode: string;
  isActive: boolean;
  isDefault: boolean;
  configJson: string;
} | null;

export function GatewayForm({ gateway }: { gateway: Gateway }) {
  return (
    <ActionForm action={saveGatewayAction} successMessage="Gateway saved.">
      {gateway && <input type="hidden" name="id" value={gateway.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name"><input name="name" defaultValue={gateway?.name} required placeholder="e.g. Stripe (live)" className={inputClass} /></Field>
        <Field label="Type">
          <select name="kind" defaultValue={gateway?.kind ?? "stripe"} className={inputClass}>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
            <option value="manual">Manual / dev (instant activation)</option>
            <option value="custom">Custom</option>
          </select>
        </Field>
        <Field label="Mode">
          <select name="mode" defaultValue={gateway?.mode ?? "test"} className={inputClass}>
            <option value="test">Test</option>
            <option value="live">Live</option>
          </select>
        </Field>
      </div>
      <div className="mt-3">
        <Field
          label="Configuration (JSON)"
          hint={'Keys depend on the gateway. Stripe: {"secretKey": "sk_…", "publishableKey": "pk_…", "webhookSecret": "whsec_…", "currency": "usd", "appUrl": "https://mytaxonme.com"}'}
        >
          <textarea name="configJson" defaultValue={gateway?.configJson ?? "{}"} rows={4} className={`${inputClass} font-mono text-xs`} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isActive" defaultChecked={gateway?.isActive ?? false} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="isDefault" defaultChecked={gateway?.isDefault ?? false} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
            Default gateway
          </label>
        </div>
        <SubmitButton>{gateway ? "Save gateway" : "Add gateway"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
