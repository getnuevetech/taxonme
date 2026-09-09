"use client";

import { useActionState } from "react";
import { reenrichIntelligenceAction } from "@/actions/admin";

type ReenrichKind = "situation" | "qa_thread" | "case";

export function IntelligenceReenrichButton({
  kind,
  id,
}: {
  kind: ReenrichKind;
  id: string;
}) {
  const [state, formAction, pending] = useActionState(reenrichIntelligenceAction, null);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Re-run Package I enrichment</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Mutates stored <code className="text-[11px]">intelligenceJson</code> via the same
            heuristic + enrich path. Fail-closed: unparseable output is not written.
          </p>
        </div>
        <form action={formAction}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {pending ? "Re-enriching…" : "Re-enrich"}
          </button>
        </form>
      </div>
      {state?.error ? <p className="mt-2 text-xs text-red-600">{state.error}</p> : null}
      {state?.ok && state.info ? <p className="mt-2 text-xs text-emerald-700">{state.info}</p> : null}
    </div>
  );
}
