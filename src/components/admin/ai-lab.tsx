"use client";

import { useRef, useState, useTransition } from "react";
import { runAiLabAction } from "@/actions/admin";
import { inputClass } from "../ui";

type Provider = {
  id: string;
  name: string;
  model: string;
  kind: string;
  supportsVision: boolean;
  hasKey: boolean;
  isEnabled: boolean;
};

type LabFunction = { key: string; name: string; description: string };

type Result = {
  providerId: string;
  providerName: string;
  model: string;
  ok: boolean;
  text: string;
  parsed: Record<string, unknown> | null;
  latencyMs: number;
  error: string;
  visionUsed: boolean;
};

// ---- Presentable rendering of structured model output (no raw JSON) ----

function humanize(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
}

function ValueView({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (isEmpty(value)) return <span className="text-slate-300">—</span>;
  if (typeof value === "boolean") {
    return (
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${value ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (typeof value === "number") return <span className="font-semibold text-slate-900">{value.toLocaleString("en-US")}</span>;
  if (typeof value === "string") return <span className="whitespace-pre-wrap text-slate-800">{value}</span>;
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return (
        <ul className="space-y-1">
          {value.map((v, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              <ValueView value={v} depth={depth + 1} />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((v, i) => (
          <div key={i} className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-400">#{i + 1}</p>
            <ValueView value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  // Plain object → labeled rows.
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <dl className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{humanize(k)}</dt>
          <dd className="text-sm leading-relaxed">
            <ValueView value={v} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function StructuredOutput({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  return (
    <div className="space-y-3">
      {entries.map(([k, v]) => (
        <div key={k} className={isEmpty(v) ? "opacity-50" : ""}>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{humanize(k)}</p>
          <div className={`text-sm leading-relaxed ${typeof v === "object" && v !== null ? "rounded-xl bg-slate-50 p-3" : ""}`}>
            <ValueView value={v} />
          </div>
        </div>
      ))}
    </div>
  );
}

type Round = { message: string; fileNames: string[]; functionName: string; results: Result[] };

export function AiLab({ providers, functions }: { providers: Provider[]; functions: LabFunction[] }) {
  const [selected, setSelected] = useState<string[]>(providers.filter((p) => p.hasKey && p.isEnabled).slice(0, 3).map((p) => p.id));
  const [functionKey, setFunctionKey] = useState("qa_chat");
  const [customPrompt, setCustomPrompt] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [histories, setHistories] = useState<Record<string, { role: string; content: string }[]>>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fn = functions.find((f) => f.key === functionKey);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 6 ? [...s, id] : s));

  const send = (formData: FormData) => {
    setError("");
    const message = String(formData.get("message") ?? "").trim();
    formData.set("providerIds", JSON.stringify(selected));
    formData.set("histories", JSON.stringify(histories));
    formData.set("functionKey", functionKey);
    formData.set("customPrompt", customPrompt);
    startTransition(async () => {
      const res = await runAiLabAction(formData);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("results" in res && res.results) {
        setRounds((r) => [...r, { message, fileNames: res.fileNames ?? [], functionName: fn?.name ?? functionKey, results: res.results }]);
        // Each model keeps its own conversation thread for follow-up turns.
        setHistories((h) => {
          const next = { ...h };
          for (const result of res.results) {
            const thread = next[result.providerId] ? [...next[result.providerId]] : [];
            thread.push({ role: "user", content: message });
            if (result.ok) thread.push({ role: "assistant", content: result.text.slice(0, 6000) });
            next[result.providerId] = thread.slice(-12);
          }
          return next;
        });
        formRef.current?.reset();
      }
    });
  };

  return (
    <div>
      {/* Model selection */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-slate-900">1 · Pick the models to compare (up to 6)</p>
        <div className="flex flex-wrap gap-2">
          {providers.map((p) => {
            const active = selected.includes(p.id);
            const usable = p.hasKey;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!usable}
                onClick={() => toggle(p.id)}
                title={usable ? p.model : "No API key saved"}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : usable
                      ? "border-slate-300 bg-white text-slate-700 hover:border-indigo-400"
                      : "border-slate-200 bg-slate-50 text-slate-300"
                }`}
              >
                {p.name}
                {p.supportsVision && <span className="ml-1.5 text-[10px] opacity-70">👁</span>}
              </button>
            );
          })}
        </div>

        <p className="mt-4 mb-2 text-sm font-semibold text-slate-900">2 · Pick the platform function to test</p>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,320px)_1fr]">
          <select value={functionKey} onChange={(e) => setFunctionKey(e.target.value)} className={inputClass}>
            {functions.map((f) => (
              <option key={f.key} value={f.key}>{f.name}</option>
            ))}
          </select>
          <p className="self-center text-xs text-slate-500">{fn?.description}</p>
        </div>
        {functionKey === "custom" && (
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            placeholder={'Your prompt template — use {{input}} where the message/conversation should be inserted.'}
            className={`${inputClass} mt-3 font-mono text-xs`}
          />
        )}

        <p className="mt-4 mb-2 text-sm font-semibold text-slate-900">3 · Post your message (attach documents/images if useful)</p>
        <form ref={formRef} action={send}>
          <textarea
            name="message"
            rows={3}
            required
            placeholder='e.g. "I expected a $3,184 refund for 2024 but received $412 and the IRS says I owe $2,800 — what happened?" — attach a transcript or notice to test document reading.'
            className={inputClass}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <input
              type="file"
              name="files"
              multiple
              accept="image/*,.pdf,.txt,.csv"
              className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700"
            />
            <div className="flex items-center gap-2">
              {rounds.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setRounds([]); setHistories({}); }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Clear conversation
                </button>
              )}
              <button
                type="submit"
                disabled={pending || selected.length === 0}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {pending ? `Running ${selected.length} model${selected.length === 1 ? "" : "s"}…` : `Run comparison →`}
              </button>
            </div>
          </div>
        </form>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <p className="mt-2 text-[11px] text-slate-400">
          Standalone tool — nothing here touches customer or consultant data. 👁 = vision-capable (receives attached files directly).
          Follow-up messages continue each model&apos;s own conversation thread.
        </p>
      </div>

      {/* Comparison rounds */}
      <div className="mt-6 space-y-8">
        {rounds.map((round, ri) => (
          <section key={ri}>
            <div className="mb-3 rounded-xl bg-slate-800 px-4 py-3 text-sm text-white">
              <span className="mr-2 rounded bg-slate-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{round.functionName}</span>
              {round.message}
              {round.fileNames.length > 0 && (
                <span className="ml-2 text-xs text-slate-300">📎 {round.fileNames.join(", ")}</span>
              )}
            </div>
            <div className={`grid gap-4 ${round.results.length === 1 ? "" : round.results.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-2 2xl:grid-cols-3"}`}>
              {round.results.map((r) => (
                <div key={r.providerId} className={`flex flex-col rounded-2xl border bg-white shadow-sm ${r.ok ? "border-slate-200" : "border-red-300"}`}>
                  <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                    <span className="font-semibold text-slate-900">{r.providerName}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{r.model}</span>
                    {r.visionUsed && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">read files 👁</span>}
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {r.ok ? `${(r.latencyMs / 1000).toFixed(1)}s` : "failed"}
                    </span>
                  </div>
                  <div className="max-h-[32rem] flex-1 overflow-y-auto p-4">
                    {r.ok ? (
                      r.parsed ? (
                        <>
                          <StructuredOutput data={r.parsed} />
                          <details className="mt-3 border-t border-slate-100 pt-2">
                            <summary className="cursor-pointer text-[11px] font-medium text-slate-400 hover:text-indigo-600">Raw response (technical)</summary>
                            <p className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-slate-500">{r.text}</p>
                          </details>
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{r.text}</p>
                      )
                    ) : (
                      <p className="text-sm text-red-600">✕ {r.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {rounds.length === 0 && !pending && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-400">
            Results appear here side by side — one column per model — with latency, parsed structure, and raw output for each.
          </p>
        )}
        {pending && (
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-6 text-sm text-indigo-900">
            <span className="h-3 w-3 animate-ping rounded-full bg-indigo-500" />
            Running the comparison — all selected models are called in parallel…
          </div>
        )}
      </div>
    </div>
  );
}
