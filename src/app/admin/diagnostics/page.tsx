import Link from "next/link";
import { guardAdminPage } from "@/lib/admin-guard";
import { getAiDiagnosticsSummary } from "@/lib/ai/diagnostics";
import { formatCaseNumber } from "@/lib/case-number";
import { Badge, Card, CardBody, PageHeader } from "@/components/ui";

export const metadata = { title: "Diagnostics" };

function metricLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function dollars(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

export default async function DiagnosticsPage() {
  await guardAdminPage("admin.ai");
  const diagnostics = await getAiDiagnosticsSummary(24);
  const statusColor = diagnostics.readiness.ok ? "green" : "red";

  return (
    <div>
      <PageHeader
        title="Diagnostics"
        subtitle="Separate v3.1 case cycles, pipeline runs, model calls, queue health, failures, retries, cache hits, token use, and cost."
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Readiness</p>
            <div className="mt-2"><Badge color={statusColor}>{diagnostics.readiness.ok ? "Ready" : "Blocked"}</Badge></div>
            <p className="mt-3 text-sm text-slate-500">
              {diagnostics.readiness.errors.length} error(s), {diagnostics.readiness.warnings.length} warning(s)
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">24h token volume</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {(diagnostics.totals.inputTokens + diagnostics.totals.outputTokens).toLocaleString("en-US")}
            </p>
            <p className="mt-1 text-sm text-slate-500">Estimated cost {dollars(diagnostics.totals.estimatedCostMicros)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Queue</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {diagnostics.counters.queuedReanalysisEvents} queued / {diagnostics.counters.runningReanalysisEvents} running
            </p>
            <p className="mt-1 text-sm text-slate-500">Processed by maintenance cron.</p>
          </CardBody>
        </Card>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {Object.entries(diagnostics.counters).map(([key, value]) => (
          <Card key={key}>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{metricLabel(key)}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{value.toLocaleString("en-US")}</p>
              <p className="mt-1 text-xs text-slate-500">{key.includes("Events") ? "Current queue state" : "Last 24 hours"}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Pipeline runs by stage</h2>
            <div className="space-y-2 text-sm">
              {diagnostics.runsByStage.length === 0 && <p className="text-slate-500">No pipeline runs in the last 24 hours.</p>}
              {diagnostics.runsByStage.map((row) => (
                <div key={row.stageKey} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{row.stageKey}</span>
                  <span className="font-semibold">{row.count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Model calls by status</h2>
            <div className="space-y-2 text-sm">
              {diagnostics.callsByStatus.length === 0 && <p className="text-slate-500">No model calls in the last 24 hours.</p>}
              {diagnostics.callsByStatus.map((row) => (
                <div key={row.status} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span>{row.status}</span>
                  <span className="font-semibold">{row.count}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Recent re-analysis events</h2>
            <div className="space-y-3 text-sm">
              {diagnostics.recentReanalysisEvents.length === 0 && <p className="text-slate-500">No re-analysis events yet.</p>}
              {diagnostics.recentReanalysisEvents.map((event) => (
                <div key={event.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{event.trigger}</span>
                    <Badge color={event.status === "complete" ? "green" : event.status === "failed" ? "red" : "amber"}>{event.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {event.case ? <Link href={`/admin/cases/${event.case.id}`} className="text-indigo-600">{formatCaseNumber(event.case.number)}</Link> : "Case unavailable"}
                    {" "}· {event.createdAt.toLocaleString("en-US")}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-slate-400">{event.pipelinesJson}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Recent failed model calls</h2>
            <div className="space-y-3 text-sm">
              {diagnostics.recentFailures.length === 0 && <p className="text-slate-500">No failed model calls recorded.</p>}
              {diagnostics.recentFailures.map((failure) => (
                <div key={failure.id} className="rounded-xl border border-red-100 bg-red-50/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{failure.roleKey}</span>
                    <Badge color="red">{failure.errorCode || "failed"}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {failure.provider?.name ?? "Provider unavailable"} · {failure.run.stageKey} ·{" "}
                    <Link href={`/admin/cases/${failure.run.case.id}`} className="text-indigo-600">{formatCaseNumber(failure.run.case.number)}</Link>
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{failure.rawText}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
