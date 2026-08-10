"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { uploadDocumentAction } from "@/actions/documents";
import { SubmitButton } from "./action-form";
import { DOC_KINDS } from "@/lib/constants";
import { inputClass } from "./ui";

export function CaseUpload({ caseId }: { caseId: string }) {
  const [state, formAction] = useActionState(uploadDocumentAction, null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-2">
      {state?.error && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>}
      <input type="hidden" name="caseId" value={caseId} />
      <input type="file" name="files" multiple className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700" />
      <div className="flex gap-2">
        <select name="docKind" className={`${inputClass} !py-1.5 text-xs`}>
          {DOC_KINDS.map((k) => (
            <option key={k.key} value={k.key}>{k.name}</option>
          ))}
        </select>
        <SubmitButton className="!px-3 !py-1.5 text-xs">Add</SubmitButton>
      </div>
    </form>
  );
}
