import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { CaseAnalysisView } from "@/components/case-analysis-view";
import { CaseComments } from "@/components/case-comments";
import { IntelligenceDiagnosticsPanel } from "@/components/admin/intelligence-diagnostics-panel";
import { summarizeForCase } from "@/lib/conversation/intelligence-diagnostics";
import { resolveCaseIntelligenceJson } from "@/lib/conversation/need-to-know-clarify";

// Admins see EXACTLY what the customer sees, plus the case discussion (with
// internal comments) and the technical pipeline diagnostics collapsed below.
export default async function AdminCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await guardAdminPage("admin.cases");
  const c = await db.case.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      originSituation: { select: { id: true, number: true, intelligenceJson: true } },
      runs: {
        orderBy: { startedAt: "desc" },
        include: {
          consensus: true,
          stepResults: { include: { provider: { select: { name: true } } } },
        },
      },
    },
  });
  if (!c) notFound();
  const usedAi = c.runs.some((r) => r.stepResults.length > 0);
  const failedCalls = c.runs.flatMap((r) => r.stepResults).filter((sr) => sr.status === "failed");
  const intelSummary = summarizeForCase({
    situation: c.situation,
    goal: c.goal,
    intelligenceJson: c.intelligenceJson,
    situationIntelligenceJson: c.originSituation?.intelligenceJson,
  });
  const rawIntel = resolveCaseIntelligenceJson({
    caseIntelligenceJson: c.intelligenceJson,
    situationIntelligenceJson: c.originSituation?.intelligenceJson,
  });

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`Case ${formatCaseNumber(c.number)} · ${c.user ? `${c.user.firstName} ${c.user.lastName} · ${c.user.email}` : "Guest intake (unclaimed)"} · created ${c.createdAt.toLocaleString("en-US")} — you are seeing the same analysis as the customer`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge color={usedAi ? "green" : "amber"}>{usedAi ? "AI pipeline" : "rule-based fallback"}</Badge>
        {failedCalls.length > 0 && (
          <Badge color="red">{failedCalls.length} failed model call{failedCalls.length === 1 ? "" : "s"} — see diagnostics below</Badge>
        )}
        {c.originSituation ? (
          <Link
            href={`/admin/intelligence?q=${encodeURIComponent(c.originSituation.id)}`}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            Open Situation intel · SIT-{c.originSituation.number}
          </Link>
        ) : null}
      </div>

      <div className="mb-6">
        <IntelligenceDiagnosticsPanel
          summary={intelSummary}
          title="Conversation intelligence (Pipeline A/B)"
          rawJson={rawIntel}
        />
      </div>

      <CaseAnalysisView caseId={c.id} viewer={{ role: "admin", userId: admin.id }} />
      <CaseComments caseId={c.id} viewer={{ role: "admin", userId: admin.id }} />

      {/* Staff-only engineering view: raw model calls and consensus data. */}
      <section className="mt-8">
        <Card>
          <CardBody>
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                ⚙ Technical diagnostics — analysis runs ({c.runs.length}), model calls, and consensus data (staff only)
              </summary>
              <div className="mt-4 space-y-3">
                {c.runs.map((r) => (
                  <details key={r.id} className="rounded-xl border border-slate-200 p-3">
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-slate-800">{r.stageKey}</span>
                      <Badge color={r.status === "complete" ? "green" : r.status === "failed" ? "red" : "slate"}>{r.status}</Badge>
                      <Badge color={r.stepResults.length > 0 ? "indigo" : "amber"}>
                        {r.stepResults.length > 0 ? `${r.stepResults.length} model calls` : "no AI (fallback)"}
                      </Badge>
                      {r.consensus?.verificationRequired && <Badge color="red">verification required</Badge>}
                      <span className="text-xs text-slate-400">{r.startedAt.toLocaleString("en-US")}</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      {r.stepResults.map((sr) => (
                        <div key={sr.id} className={`rounded-lg p-3 text-xs ${sr.status === "failed" ? "bg-red-50" : "bg-slate-50"}`}>
                          <p className={`font-medium ${sr.status === "failed" ? "text-red-700" : "text-slate-700"}`}>
                            {sr.provider?.name ?? "(provider removed)"} · {sr.roleKey} · {sr.status} · {sr.latencyMs}ms
                          </p>
                          {sr.rawText && (
                            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-slate-500">{sr.rawText.slice(0, 1500)}</pre>
                          )}
                        </div>
                      ))}
                      {r.consensus && (
                        <div className="rounded-lg bg-indigo-50 p-3 text-xs">
                          <p className="font-medium text-indigo-800">Consensus</p>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-indigo-700">
                            {JSON.stringify({ merged: JSON.parse(r.consensus.mergedJson || "{}"), conflicts: JSON.parse(r.consensus.conflictsJson || "[]") }, null, 2).slice(0, 2000)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
