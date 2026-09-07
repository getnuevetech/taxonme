import type { IntelligenceDiagnosticsSummary } from "@/lib/conversation/intelligence-diagnostics";

export function IntelligenceDiagnosticsPanel({
  summary,
  title = "Conversation intelligence",
  rawJson,
}: {
  summary: IntelligenceDiagnosticsSummary;
  title?: string;
  rawJson?: string | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Read-only Pipeline A/B routing snapshot · source{" "}
            <span className="font-medium text-slate-700">{summary.source}</span>
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          {summary.pipeline} · {summary.workspace}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <DiagField label="decision_target" value={summary.decision_target} />
        <DiagField label="response_mode" value={summary.response_mode} />
        <DiagField label="pipeline" value={summary.pipeline} />
        <DiagField label="workspace" value={summary.workspace} />
        <DiagField
          label="routing_confidence"
          value={summary.routing_confidence.toFixed(2)}
        />
        <DiagField
          label="invokes_case_engine"
          value={summary.invokes_case_engine ? "true" : "false"}
        />
        <DiagField
          label="clarify_first_required"
          value={summary.clarify_first_required ? "true" : "false"}
        />
        <DiagField
          label="clarification_reason"
          value={summary.clarification_reason || "—"}
        />
      </dl>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">interpreted_question</p>
        <p className="text-sm text-slate-800">{summary.interpreted_question || "—"}</p>
        {summary.explicit_question ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">explicit_question</p>
            <p className="text-sm text-slate-700">{summary.explicit_question}</p>
          </>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">ask_now</p>
        {summary.ask_now.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">None</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {summary.ask_now.map((item) => (
              <li key={item.question} className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
                <p className="text-sm font-medium text-slate-900">{item.question}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {item.tier} · {item.reason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(summary.clarification_selected || summary.questions_suppressed.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              clarification_selected
            </p>
            <p className="mt-1 text-sm text-slate-700">{summary.clarification_selected || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              questions_suppressed
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {summary.questions_suppressed.length
                ? summary.questions_suppressed.slice(0, 5).join(" · ")
                : "—"}
            </p>
          </div>
        </div>
      )}

      {rawJson ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-indigo-600">Raw intelligenceJson</summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
            {rawJson}
          </pre>
        </details>
      ) : null}
    </section>
  );
}

function DiagField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-sm text-slate-900">{value}</dd>
    </div>
  );
}
