"use client";

import { ActionForm, SubmitButton } from "../action-form";
import { savePlanAction, saveFeatureMatrixAction, saveSettingsAction } from "@/actions/admin";
import { Field, inputClass } from "../ui";

type Plan = {
  id: string;
  key: string;
  name: string;
  audience: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  badge: string;
  sortOrder: number;
  isActive: boolean;
} | null;

export function PlanForm({ plan }: { plan: Plan }) {
  return (
    <ActionForm action={savePlanAction} successMessage="Plan saved.">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Key" hint="Stable identifier, e.g. free / plus / pro">
          <input name="key" defaultValue={plan?.key} required className={inputClass} />
        </Field>
        <Field label="Name"><input name="name" defaultValue={plan?.name} required className={inputClass} /></Field>
        <Field label="Audience" hint="Who can subscribe to this plan.">
          <select name="audience" defaultValue={plan?.audience ?? "customer"} className={inputClass}>
            <option value="customer">Customers</option>
            <option value="consultant">CPA / Consultants</option>
          </select>
        </Field>
        <Field label="Badge" hint="e.g. 'Most popular' (optional)"><input name="badge" defaultValue={plan?.badge} className={inputClass} /></Field>
        <Field label="Price / month (USD)"><input name="priceMonthly" type="number" step="0.01" defaultValue={plan?.priceMonthly ?? 0} className={inputClass} /></Field>
        <Field label="Price / year (USD)"><input name="priceYearly" type="number" step="0.01" defaultValue={plan?.priceYearly ?? 0} className={inputClass} /></Field>
        <Field label="Sort order"><input name="sortOrder" type="number" defaultValue={plan?.sortOrder ?? 0} className={inputClass} /></Field>
      </div>
      <div className="mt-3">
        <Field label="Description"><input name="description" defaultValue={plan?.description} className={inputClass} /></Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={plan?.isActive ?? true} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
          Active (visible on pricing page)
        </label>
        <SubmitButton>{plan ? "Save plan" : "Add plan"}</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ConsultantSubsToggle({ enabled }: { enabled: boolean }) {
  return (
    <ActionForm action={saveSettingsAction} successMessage="Consultant subscription setting saved.">
      <div className="flex items-center gap-3">
        <input type="hidden" name="setting:consultants.subscriptions_enabled" value="false" />
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="setting:consultants.subscriptions_enabled"
            value="true"
            defaultChecked={enabled}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600"
          />
          Require a partner subscription for consultants to accept clients
        </label>
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function FeatureMatrix({
  plans,
  features,
  values,
}: {
  plans: { id: string; name: string }[];
  features: { key: string; name: string; category: string }[];
  values: { planId: string; featureKey: string; enabled: boolean; limitValue: number | null }[];
}) {
  const get = (planId: string, featureKey: string) =>
    values.find((v) => v.planId === planId && v.featureKey === featureKey);

  return (
    <ActionForm action={saveFeatureMatrixAction} successMessage="Access matrix saved.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Feature</th>
              {plans.map((p) => (
                <th key={p.id} className="px-3 py-2 text-center">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {features.map((f) => (
              <tr key={f.key}>
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-slate-800">{f.name}</p>
                  <p className="text-xs text-slate-400">{f.key}</p>
                </td>
                {plans.map((p) => {
                  const v = get(p.id, f.key);
                  return (
                    <td key={p.id} className="px-3 py-2.5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <input
                          type="checkbox"
                          name={`f:${p.id}:${f.key}`}
                          defaultChecked={v?.enabled ?? false}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        <input
                          name={`l:${p.id}:${f.key}`}
                          defaultValue={v?.limitValue ?? ""}
                          placeholder="∞"
                          className="w-14 rounded border border-slate-200 px-1 py-0.5 text-center text-xs"
                          title="Monthly limit (empty = unlimited)"
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4"><SubmitButton>Save matrix</SubmitButton></div>
    </ActionForm>
  );
}
