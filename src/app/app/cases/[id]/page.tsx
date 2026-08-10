import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { PageHeader, Card, CardBody, StateMark, ConfidenceBadge, ProgressBar, Money, Badge, ButtonLink } from "@/components/ui";
import { reanalyzeCaseAction, completePathStepAction } from "@/actions/case";
import { CaseUpload } from "@/components/case-upload";

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const c = await db.case.findFirst({
    where: { id, userId: user.id },
    include: {
      issues: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      pathSteps: { orderBy: { sortOrder: "asc" } },
      documents: { where: { deletedAt: null } },
      runs: { orderBy: { startedAt: "desc" }, include: { consensus: true }, take: 10 },
    },
  });
  if (!c) notFound();

  const fullAccess = await hasFeature(user.id, FEATURE_KEYS.CASE_FULL_RESULTS);
  const visibleIssues = fullAccess ? c.issues : c.issues.slice(0, 1);
  const verificationFlags = c.runs.filter((r) => r.consensus?.verificationRequired).length;

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`Opened ${c.createdAt.toLocaleDateString("en-US")} · ${c.issues.length} issue${c.issues.length === 1 ? "" : "s"} identified`}
        actions={
          <form action={reanalyzeCaseAction.bind(null, c.id)}>
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Re-run analysis
            </button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {c.status === "consultant_recommended" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="font-semibold">▲ Professional review recommended.</span> Based on the analysis, this case would benefit
              from a licensed professional. Our team has been notified and may recommend a consultant — you always approve first.
            </div>
          )}
          {verificationFlags > 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <span className="font-semibold">◐ Verification required.</span> Our analysis engines disagreed on some values, so we never
              guess — adding more documents (like your IRS account transcript) resolves this.
            </div>
          )}

          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">What we found</h2>
            <div className="space-y-4">
              {visibleIssues.length === 0 && (
                <Card><CardBody className="text-sm text-slate-500">The analysis is still in progress or found nothing actionable yet. Try re-running it after adding documents.</CardBody></Card>
              )}
              {visibleIssues.map((issue) => (
                <Card key={issue.id}>
                  <CardBody>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {issue.taxYear ? `${issue.taxYear} · ` : ""}{issue.title}
                      </h3>
                      <div className="flex gap-2">
                        <StateMark state={issue.state} />
                        <ConfidenceBadge level={issue.confidence} />
                      </div>
                    </div>
                    {(issue.expectedCents !== null || issue.differenceCents !== null) && (
                      <div className="mt-3 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4 text-center">
                        <div>
                          <p className="text-xs text-slate-500">Expected</p>
                          <p className="text-lg font-bold text-slate-900"><Money cents={issue.expectedCents} /></p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Received / assessed</p>
                          <p className="text-lg font-bold text-slate-900"><Money cents={issue.receivedCents} /></p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Difference</p>
                          <p className="text-lg font-bold text-indigo-600"><Money cents={issue.differenceCents} /></p>
                        </div>
                      </div>
                    )}
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">{issue.description}</p>
                    {issue.irsBasis && (
                      <p className="mt-2 text-xs text-slate-400">IRS basis: {issue.irsBasis}</p>
                    )}
                    {issue.nextAction && (
                      <p className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800">
                        Next step: {issue.nextAction.replace(/_/g, " ").toLowerCase()}
                      </p>
                    )}
                  </CardBody>
                </Card>
              ))}
              {!fullAccess && c.issues.length > 1 && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 text-center">
                  <p className="font-semibold text-indigo-900">
                    {c.issues.length - 1} more issue{c.issues.length - 1 === 1 ? "" : "s"} in your full analysis
                  </p>
                  <p className="mt-1 text-sm text-indigo-700">Upgrade your plan to unlock every issue, amount, and step.</p>
                  <div className="mt-4"><ButtonLink href="/app/billing">See plans →</ButtonLink></div>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Path forward</h2>
            <Card>
              <CardBody className="space-y-1">
                {c.pathSteps.map((step, i) => (
                  <div key={step.id} className={`flex items-start gap-3 rounded-xl p-3 ${step.status === "current" ? "bg-indigo-50" : ""}`}>
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        step.status === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : step.status === "current"
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {step.status === "done" ? "✓" : i + 1}
                    </span>
                    <div className="flex-1">
                      <p className={`font-medium ${step.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {step.title}
                      </p>
                      <p className="text-sm text-slate-500">{step.description}</p>
                    </div>
                    {step.status === "current" && (
                      <form action={completePathStepAction.bind(null, step.id)}>
                        <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                          Done ✓
                        </button>
                      </form>
                    )}
                  </div>
                ))}
                {c.pathSteps.length === 0 && <p className="p-3 text-sm text-slate-500">Steps appear after analysis completes.</p>}
              </CardBody>
            </Card>
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <ProgressBar value={c.readinessScore} label="Case readiness" />
              <p className="mt-2 text-xs text-slate-500">
                Computed from documents obtained, facts verified, IRS source confirmation, and unresolved contradictions.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-sm font-semibold text-slate-900">Your goal</h3>
              <p className="mt-1 text-sm text-slate-600">{c.goal || "No goal recorded."}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Case documents ({c.documents.length})</h3>
              <ul className="space-y-1.5">
                {c.documents.map((d) => (
                  <li key={d.id}>
                    <Link href={`/api/files/${d.id}`} target="_blank" className="text-sm text-indigo-600 underline">
                      {d.fileName}
                    </Link>
                    <Badge>{d.docKind}</Badge>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <CaseUpload caseId={c.id} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <h3 className="text-sm font-semibold text-slate-900">Analysis history</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {c.runs.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{r.stageKey} · {r.status}</span>
                    <span>{r.startedAt.toLocaleTimeString("en-US")}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
