"use client";

import { useActionState } from "react";
import { forceReenrichIntelligenceAction } from "@/actions/admin";

export function IntelligenceForceReenrichPanel() {
  const [state, formAction, pending] = useActionState(forceReenrichIntelligenceAction, null);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Force re-enrich (overwrite)</h2>
      <p className="mt-1 text-xs text-slate-600">
        Package X — overwrites <strong>parseable</strong>{" "}
        <code className="text-[11px]">intelligenceJson</code> via Package R. Empty snapshots stay on
        Package T/W empty-only backfill. Requires explicit overwrite acknowledgment to apply.
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Kind</span>
          <select
            name="kind"
            defaultValue="case"
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
          >
            <option value="case">Case</option>
            <option value="situation">Situation</option>
            <option value="qa_thread">QaThread</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Limit</span>
          <input
            name="limit"
            type="number"
            min={1}
            max={500}
            defaultValue={25}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="dryRun" value="1" defaultChecked className="rounded border-slate-300" />
          Dry run
        </label>
        <label className="flex items-center gap-2 text-sm text-amber-900">
          <input type="checkbox" name="confirmOverwrite" value="1" className="rounded border-amber-400" />
          I understand this overwrites stored intel
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {pending ? "Running…" : "Run force re-enrich"}
        </button>
      </form>
      {state?.error ? <p className="mt-2 text-xs text-red-600">{state.error}</p> : null}
      {state?.ok && state.info ? <p className="mt-2 text-xs text-emerald-800">{state.info}</p> : null}
    </div>
  );
}
