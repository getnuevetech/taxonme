"use client";

import { useState, useTransition } from "react";
import { refreshFormPdfAction } from "@/actions/admin";

export function FormPdfRefresh({ templateId }: { templateId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ info?: string; error?: string } | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const res = await refreshFormPdfAction(templateId);
            setResult(res ?? { error: "No response." });
          })
        }
        className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
      >
        {pending ? "Fetching…" : "⟳ Fetch official PDF"}
      </button>
      {result && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${result.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>
          {result.error ? `✕ ${result.error}` : `✓ ${result.info}`}
        </p>
      )}
    </div>
  );
}
