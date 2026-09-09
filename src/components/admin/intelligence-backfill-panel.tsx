"use client";

import { useActionState } from "react";
import { backfillCaseIntelligenceAction } from "@/actions/admin";

export function IntelligenceBackfillPanel() {
  const [state, formAction, pending] = useActionState(backfillCaseIntelligenceAction, null);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Backfill empty Case intelligence</h2>
      <p className="mt-1 text-xs text-slate-500">
        Package T — writes Package I/R enrichment only for Cases with empty or unparseable{" "}
        <code className="text-[11px]">intelligenceJson</code>. Never overwrites a parseable snapshot.
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Limit</span>
          <input
            name="limit"
            type="number"
            min={1}
            max={500}
            defaultValue={50}
            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="dryRun" value="1" defaultChecked className="rounded border-slate-300" />
          Dry run
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Running…" : "Run backfill"}
        </button>
      </form>
      {state?.error ? <p className="mt-2 text-xs text-red-600">{state.error}</p> : null}
      {state?.ok && state.info ? <p className="mt-2 text-xs text-emerald-700">{state.info}</p> : null}
    </div>
  );
}
