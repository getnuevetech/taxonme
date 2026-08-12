"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { addCaseCommentAction } from "@/actions/comments";
import { inputClass } from "./ui";

export function CommentComposer({ caseId, checkboxLabel }: { caseId: string; checkboxLabel: string | null }) {
  const [state, formAction, pending] = useActionState(addCaseCommentAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction}>
      {state?.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <input type="hidden" name="caseId" value={caseId} />
      <div className="flex items-start gap-2">
        <textarea name="body" rows={2} placeholder="Write a comment…" className={inputClass} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {pending ? "Posting…" : "Post"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="files"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.png,.jpg,.jpeg,.heic,.webp"
          className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700"
        />
        <span className="text-[11px] text-slate-400">
          Attached files join the case documents and are analyzed automatically.
        </span>
      </div>
      {checkboxLabel && (
        <label className="mt-2 flex items-start gap-2 text-xs text-slate-600">
          <input type="checkbox" name="hide" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600" />
          {checkboxLabel}
        </label>
      )}
    </form>
  );
}
