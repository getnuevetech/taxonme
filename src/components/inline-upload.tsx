"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadDocumentAction } from "@/actions/documents";
import { IconUpload } from "@/components/icons";

// One-click in-place upload: the file picker opens right where the finding
// asks for it, submits automatically, and the analysis re-runs. Without a
// caseId (e.g. from a general Q&A thread) it just lands in the document
// vault — there is nothing case-specific to re-analyze.
export function InlineUpload({
  caseId,
  situationId,
  docKind = "other",
  label = "Upload documents",
  iconOnly = false,
}: {
  caseId?: string;
  situationId?: string;
  docKind?: string;
  label?: string;
  /** Compact square icon button instead of the labeled pill — for tight spaces like a chat input row. */
  iconOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(uploadDocumentAction, null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={formAction} className="inline-block">
      {caseId && <input type="hidden" name="caseId" value={caseId} />}
      {situationId && <input type="hidden" name="situationId" value={situationId} />}
      <input type="hidden" name="docKind" value={docKind} />
      <label
        title={label}
        className={
          iconOnly
            ? `inline-flex h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-xl border transition ${
                pending ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
              }`
            : `inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                pending ? "bg-slate-300 text-slate-500" : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`
        }
      >
        {iconOnly ? <IconUpload className="h-5 w-5" /> : pending ? `Uploading${caseId ? " & re-analyzing" : ""}…` : `${label} →`}
        <input
          type="file"
          name="files"
          multiple
          disabled={pending}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) e.target.form?.requestSubmit();
          }}
        />
      </label>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
