"use client";

import { useActionState } from "react";
import { adminSendResetLinkAction } from "@/actions/admin";

// Admin pushes a password-reset link to a customer or consultant.
// The link is emailed when SMTP is configured and always shown for manual delivery.
export function ResetLinkButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(adminSendResetLinkAction, null);
  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <button disabled={pending} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
          {pending ? "Sending…" : "Password reset"}
        </button>
      </form>
      {state?.error && <p className="mt-1 max-w-56 text-left text-xs text-red-600">{state.error}</p>}
      {state?.ok && (
        <div className="mt-1 max-w-72 text-left text-xs text-emerald-700">
          <p>{state.info}</p>
          {state.link && (
            <div className="mt-1 flex items-center gap-2">
              <a href={state.link} target="_blank" className="font-medium text-indigo-600 underline">
                Open reset link ↗
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(state.link!)}
                className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
