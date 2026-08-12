"use client";

import { useState, useActionState } from "react";
import { subscribeAction } from "@/actions/billing";
import { SubmitButton } from "./action-form";

type Plan = {
  id: string;
  name: string;
  description: string;
  badge: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  features: { name: string; limit: number | null }[];
};

export type PlanDiscountInfo = { name: string; percentOff: number; amountOffCents: number };

function discounted(cents: number, d?: PlanDiscountInfo): number {
  if (!d || cents <= 0) return cents;
  const off = d.percentOff > 0 ? Math.round((cents * d.percentOff) / 100) : d.amountOffCents;
  return Math.max(0, cents - off);
}

export function PlanPicker({
  plans,
  currentPlanId,
  discounts = {},
}: {
  plans: Plan[];
  currentPlanId: string;
  discounts?: Record<string, PlanDiscountInfo>;
}) {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [state, formAction] = useActionState(subscribeAction, null);

  return (
    <div>
      <div className="mb-4 flex justify-center gap-1 rounded-full bg-slate-200 p-1 text-sm font-medium sm:mx-auto sm:w-fit">
        {(["monthly", "yearly"] as const).map((iv) => (
          <button
            key={iv}
            onClick={() => setInterval(iv)}
            className={`rounded-full px-5 py-1.5 capitalize transition ${interval === iv ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}
          >
            {iv}
          </button>
        ))}
      </div>
      {state?.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const basePrice = interval === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
          const deal = discounts[plan.id];
          const price = discounted(basePrice, deal);
          const onSale = Boolean(deal) && price < basePrice;
          const isCurrent = plan.id === currentPlanId;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${onSale ? "border-emerald-400 ring-1 ring-emerald-400" : plan.badge ? "border-indigo-400 ring-1 ring-indigo-400" : "border-slate-200"}`}
            >
              {onSale && (
                <span className="absolute -top-3 left-4 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-bold text-white shadow">
                  {deal!.name}{deal!.percentOff > 0 ? ` · ${deal!.percentOff}% off` : ""}
                </span>
              )}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">{plan.name}</h3>
                {plan.badge && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{plan.badge}</span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
              <p className="mt-3">
                {onSale && (
                  <span className="mr-2 text-lg font-semibold text-slate-400 line-through">${(basePrice / 100).toFixed(0)}</span>
                )}
                <span className={`text-3xl font-extrabold ${onSale ? "text-emerald-600" : "text-slate-900"}`}>${(price / 100).toFixed(0)}</span>
                <span className="text-sm text-slate-400">/{interval === "yearly" ? "year" : "month"}</span>
              </p>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
                {plan.features.map((f) => (
                  <li key={f.name} className="flex gap-2">
                    <span className="font-bold text-emerald-600">✓</span>
                    {f.name}
                    {f.limit !== null && <span className="text-slate-400">· {f.limit}/mo</span>}
                  </li>
                ))}
              </ul>
              <form action={formAction} className="mt-5">
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="interval" value={interval} />
                {isCurrent ? (
                  <p className="rounded-lg bg-slate-100 py-2 text-center text-sm font-medium text-slate-500">Current plan</p>
                ) : (
                  <SubmitButton className="w-full">{price === 0 ? "Switch to free" : `Get ${plan.name}`}</SubmitButton>
                )}
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
