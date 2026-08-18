import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";

export const metadata = { title: "AI run audit" };

export default async function AiRunsPage() {
  await guardAdminPage("admin.ai");
  const runs = await db.analysisRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      case: { select: { id: true, number: true, title: true } },
      stepResults: { include: { provider: { select: { name: true } } } },
    },
  });

  return (
    <div>
      <PageHeader title="AI run audit" subtitle="Pipeline, prompt/schema/provider route, token, cost, source snapshot, and quality-gate records for case analysis runs." />
      <Card>
        <CardBody>
          <div className="space-y-4">
            {runs.map((run) => (
              <details key={run.id} className="rounded-xl border border-slate-200">
                <summary className="cursor-pointer px-4 py-3 text-sm">
                  <span className="mr-2 font-semibold">{run.stageKey}</span>
                  <Badge color={run.status === "complete" ? "green" : run.status === "failed" ? "red" : "amber"}>{run.status}</Badge>
                  <span className="ml-2 text-slate-500">
                    {run.case
                      ? <Link href={`/admin/cases/${run.case.id}`} className="text-indigo-600 hover:text-indigo-800">{formatCaseNumber(run.case.number)}</Link>
                      : <span>System / helper call</span>}
                    {" "}v{run.caseAnalysisVersion} · {run.startedAt.toLocaleString("en-US")}
                  </span>
                </summary>
                <div className="border-t border-slate-100 p-4">
                  <p className="mb-3 text-xs text-slate-500">
                    pipeline {run.pipelineVersion || "n/a"}; schema {run.schemaVersion || "n/a"}; source snapshot {run.sourceSnapshotId || "none"}
                  </p>
                  <table className="min-w-full text-xs">
                    <thead className="text-left uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-1 pr-3">Role</th>
                        <th className="py-1 pr-3">Provider</th>
                        <th className="py-1 pr-3">Prompt</th>
                        <th className="py-1 pr-3">Route</th>
                        <th className="py-1 pr-3">Quality</th>
                        <th className="py-1 pr-3">Tokens</th>
                        <th className="py-1 pr-3">Cost</th>
                        <th className="py-1 pr-3">Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.stepResults.map((step) => (
                        <tr key={step.id} className="border-t border-slate-100">
                          <td className="py-2 pr-3">{step.roleKey}</td>
                          <td className="py-2 pr-3">{step.provider?.name ?? "n/a"}</td>
                          <td className="py-2 pr-3 font-mono">{step.promptId || "legacy"}</td>
                          <td className="py-2 pr-3">{step.providerRoute || "n/a"}</td>
                          <td className="py-2 pr-3"><Badge color={step.qualityGate === "PASS" ? "green" : "amber"}>{step.qualityGate || step.status}</Badge></td>
                          <td className="py-2 pr-3">{step.inputTokens}/{step.outputTokens}</td>
                          <td className="py-2 pr-3">{(step.estimatedCostMicros / 1_000_000).toFixed(4)}</td>
                          <td className="py-2 pr-3">{step.latencyMs}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
