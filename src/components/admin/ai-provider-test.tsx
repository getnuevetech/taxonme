"use client";

import { useState, useTransition } from "react";
import { testAiProviderAction } from "@/actions/admin";

// Per-provider connectivity tester: sends a tiny prompt through the real
// adapter and shows the live result (latency + reply, or the upstream error).
export function AiProviderTest({ providerId, disabled }: { providerId: string; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok?: boolean; info?: string; error?: string } | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const res = await testAiProviderAction(providerId);
            setResult(res ?? { error: "No response from the test." });
          })
        }
        className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50"
        title={disabled ? "Save an API key first" : "Send a live test prompt to this model"}
      >
        {pending ? "Testing…" : "▶ Test connection"}
      </button>
      {result && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-xs ${
            result.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {result.error ? `✕ ${result.error}` : `✓ ${result.info}`}
        </p>
      )}
    </div>
  );
}
