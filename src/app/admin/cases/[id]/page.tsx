import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge, StateMark, ProgressBar, Money } from "@/components/ui";

export default async function AdminCaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await guardAdminPage("admin.cases");
  const c = await db.case.findUnique({
    where: { id },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      issues: { orderBy: { createdAt: "asc" } },
      pathSteps: { orderBy: { sortOrder: "asc" } },
      documents: { where: { deletedAt: null } },
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

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`${c.user ? `${c.user.firstName} ${c.user.lastName} · ${c.user.email}` : "Guest intake (unclaimed)"} · created ${c.createdAt.toLocaleString("en-US")}`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge color={c.status === "analyzed" ? "green" : c.status === "consultant_recommended" ? "amber" : "slate"}>
          {c.status.replace(/_/g, " ")}
        </Badge>
        <Badge color={usedAi ? "green" : "amber"}>{usedAi ? "AI pipeline" : "rule-based fallback"}</Badge>
        <Badge>{c.documents.length} documents</Badge>
        <div className="w-48"><ProgressBar value={c.readinessScore} /></div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Situation & goal</h2>
          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Situation</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{c.situation}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Goal</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{c.goal || "—"}</p>
            </CardBody>
          </Card>

          <h2 className="mb-3 mt-6 text-base font-semibold text-slate-900">Issues ({c.issues.length})</h2>
          <div className="space-y-3">
            {c.issues.map((i) => (
              <Card key={i.id}>
                <CardBody className="!p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-slate-900">{i.taxYear ? `${i.taxYear} · ` : ""}{i.title}</p>
                    <StateMark state={i.state} />
                  </div>
                  {i.differenceCents !== null && (
                    <p className="mt-1 text-sm text-slate-600">
                      Expected <Money cents={i.expectedCents} /> · Received <Money cents={i.receivedCents} /> · Difference{" "}
                      <Money cents={i.differenceCents} />
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">
                    {i.issueType} · confidence {i.confidence} · priority {i.priority}
                    {i.nextAction ? ` · next: ${i.nextAction}` : ""}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>

          <h2 className="mb-3 mt-6 text-base font-semibold text-slate-900">Path steps</h2>
          <Card>
            <CardBody className="!p-4">
              <ul className="space-y-2 text-sm">
                {c.pathSteps.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span className={s.status === "done" ? "text-slate-400 line-through" : "text-slate-700"}>
                      {s.sortOrder + 1}. {s.title}
                    </span>
                    <span className="flex items-center gap-2">
                      {s.actionKey && <Badge>{s.actionKey}</Badge>}
                      <Badge color={s.status === "done" ? "green" : s.status === "current" ? "indigo" : "slate"}>{s.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Analysis runs ({c.runs.length})</h2>
          <div className="space-y-3">
            {c.runs.map((r) => (
              <Card key={r.id}>
                <CardBody className="!p-4">
                  <details>
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
                        <div key={sr.id} className="rounded-lg bg-slate-50 p-3 text-xs">
                          <p className="font-medium text-slate-700">
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
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
