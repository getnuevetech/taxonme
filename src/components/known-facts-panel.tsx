"use client";

import { useState } from "react";
import type { KnownFact } from "@/lib/form-prefill";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable (http) — user can still select the text */ }
      }}
      className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
        copied ? "bg-emerald-100 text-emerald-700" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
      }`}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

export function KnownFactsPanel({ facts }: { facts: KnownFact[] }) {
  if (facts.length === 0) return null;
  return (
    <aside className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5">
      <h3 className="text-sm font-bold text-slate-900">What we already know</h3>
      <p className="mt-1 text-xs text-slate-500">
        From your profile and case analysis. Copy anything you need while completing this form.
      </p>
      <dl className="mt-4 space-y-3">
        {facts.map((f) => (
          <div key={f.label} className="rounded-lg bg-white p-2.5 ring-1 ring-slate-100">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</dt>
            <dd className="mt-0.5 flex items-start justify-between gap-2">
              <span className="break-words text-sm text-slate-800">{f.value}</span>
              <CopyButton value={f.value} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-slate-400">
        Always double-check amounts against your IRS notice or transcript before filing.
      </p>
    </aside>
  );
}
