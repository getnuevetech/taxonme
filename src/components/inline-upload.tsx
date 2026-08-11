"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadDocumentAction } from "@/actions/documents";

// One-click in-place upload: the file picker opens right where the finding
// asks for it, submits automatically, and the analysis re-runs.
export function InlineUpload({
  caseId,
  docKind = "other",
  label = "Upload documents",
}: {
  caseId: string;
  docKind?: string;
  label?: string;
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
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="docKind" value={docKind} />
      <label
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          pending ? "bg-slate-300 text-slate-500" : "bg-indigo-600 text-white hover:bg-indigo-700"
        }`}
      >
        {pending ? "Uploading & re-analyzing…" : `${label} →`}
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
