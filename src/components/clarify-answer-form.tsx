"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { clarifyAnswerAction } from "@/actions/case";
import { inputClass } from "./ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
    >
      {pending ? "Updating analysis…" : "Send ↵"}
    </button>
  );
}

export function ClarifyAnswerForm({ caseId }: { caseId: string }) {
  const [state, formAction] = useActionState(clarifyAnswerAction, null);
  return (
    <form action={formAction} key={state?.ok ? Date.now() : "form"}>
      <input type="hidden" name="caseId" value={caseId} />
      {state?.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <div className="flex items-start gap-2">
        <textarea
          name="answer"
          rows={2}
          required
          placeholder="Type your answer… (amounts like $3,214 and dates help most)"
          className={`${inputClass} flex-1`}
        />
        <Submit />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        Sending re-runs your analysis with this answer included — findings above update immediately.
      </p>
    </form>
  );
}
