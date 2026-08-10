"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { uploadNoticeAction } from "@/actions/documents";
import { SubmitButton } from "./action-form";
import { inputClass } from "./ui";

export function NoticeUpload() {
  const [state, formAction] = useActionState(uploadNoticeAction, null);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Notice received — see its explanation below.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-indigo-400">
          <span className="text-sm font-medium text-slate-700">Upload or photograph the notice</span>
          <span className="mt-1 text-xs text-slate-400">PDF or photo — use your phone camera if you like</span>
          <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.txt,image/*,application/pdf" capture="environment" className="mt-2 text-xs" />
        </label>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">…or paste the text of the letter</p>
          <textarea name="pastedText" rows={4} className={inputClass} placeholder="Paste what the letter says, including the notice number (like CP2000) if you see one…" />
        </div>
      </div>
      <SubmitButton>Explain this notice →</SubmitButton>
    </form>
  );
}
