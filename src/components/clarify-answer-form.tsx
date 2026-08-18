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

export function ClarifyAnswerForm({ caseId, placeholder }: { caseId: string; placeholder: string }) {
  const [state, formAction] = useActionState(clarifyAnswerAction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="caseId" value={caseId} />
      {state?.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
      <div className="flex items-start gap-2">
        <textarea
          name="answer"
          rows={2}
          placeholder={placeholder}
          className={`${inputClass} flex-1`}
        />
        <Submit />
      </div>
      <div className="mt-3 rounded-xl bg-white/70 p-3 ring-1 ring-indigo-100">
        <label className="block text-xs font-medium text-slate-600">Add documents to this answer</label>
        <input
          type="file"
          name="files"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg,.heic,.webp"
          className="mt-2 block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-medium file:text-indigo-700 file:ring-1 file:ring-indigo-200"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Optional: upload notices, transcripts, or photos that answer this question. They are added to your vault and included in the next analysis pass.
        </p>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        Sending re-runs your analysis with this answer included — findings above update immediately.
      </p>
    </form>
  );
}
