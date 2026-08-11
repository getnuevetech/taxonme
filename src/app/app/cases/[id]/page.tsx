import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";
import { PageHeader, Card, CardBody, StateMark, ConfidenceBadge, ProgressBar, Money, Badge, ButtonLink } from "@/components/ui";
import { reanalyzeCaseAction, completePathStepAction, checkCaseProgressAction } from "@/actions/case";
import { startFormAction } from "@/actions/forms";
import { isVerifiable, VERIFIABLE_ACTIONS } from "@/lib/case-progress";
import { formatCaseNumber } from "@/lib/case-number";
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
  const hasReportAccess = await hasFeature(user.id, FEATURE_KEYS.CASE_REPORT);

  // Direct route to the Form 9465 wizard when a step calls for it.
  const form9465 = await db.irsFormTemplate.findFirst({
    where: { formNumber: "9465", isPublished: true },
    select: { id: true },
  });

  // Every actionable step gets a CTA that takes the user straight to where
  // the task is executed.
  const stepCta = (actionKey: string): { label: string; href: string } | null => {
    switch (actionKey.toUpperCase()) {
      case "UPLOAD_DOCUMENTS":
        return { label: "Upload documents", href: "#case-documents" };
      case "GET_TRANSCRIPT":
      case "GET_ACCOUNT_TRANSCRIPT":
        return { label: "How to get my transcript", href: "/app/irs-account" };
      case "DRAFT_LETTER":
        return { label: "Draft my letter", href: "/app/letters/new" };
      case "COMPLETE_FORM_9465":
        return form9465 ? { label: "Open the payment plan form", href: `/app/forms` } : { label: "Open IRS forms", href: "/app/forms" };
      case "ADD_DEADLINE":
        return { label: "Add the deadline", href: "/app/deadlines" };
      default:
        return null;
    }
  };
  const visibleIssues = fullAccess ? c.issues : c.issues.slice(0, 1);
  const verificationFlags = c.runs.filter((r) => r.consensus?.verificationRequired).length;
  // If no AI provider produced output, this analysis came from the rule-based engine.
  const aiStepCount = await db.analysisStepResult.count({
    where: { run: { caseId: c.id }, status: "complete" },
  });
  const isPreliminary = c.runs.length > 0 && aiStepCount === 0;

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`Case ${formatCaseNumber(c.number)} · Opened ${c.createdAt.toLocaleDateString("en-US")} · ${c.issues.length} issue${c.issues.length === 1 ? "" : "s"} identified`}
        actions={
          <div className="flex gap-2">
            <a
              href={`/api/cases/${c.id}/report`}
              target="_blank"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title={hasReportAccess ? "View the full case report (print for PDF)" : "Included in higher plans"}
            >
              {hasReportAccess ? "Case report ↗" : "Case report 🔒"}
            </a>
            <form action={reanalyzeCaseAction.bind(null, c.id)}>
              <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Re-run analysis
              </button>
            </form>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isPreliminary && (
            <div className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
              <span className="font-semibold">? Preliminary review.</span> These results come from our rule-based checks of your
              answers and readable documents. Full multi-model AI verification runs automatically once the platform&apos;s AI
              providers are connected.
            </div>
          )}
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
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Path forward</h2>
              <form action={checkCaseProgressAction.bind(null, c.id)}>
                <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  ↻ Check my progress
                </button>
              </form>
            </div>
            <Card>
              <CardBody className="space-y-1">
                {c.pathSteps.map((step, i) => {
                  const verifiable = isVerifiable(step.actionKey);
                  return (
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
                        {verifiable && step.status !== "done" && (
                          <p className="mt-1 text-xs font-medium text-indigo-600">
                            ◐ Verified automatically — {VERIFIABLE_ACTIONS[step.actionKey.toUpperCase()].toLowerCase()}
                          </p>
                        )}
                        {verifiable && step.status === "done" && (
                          <p className="mt-1 text-xs font-medium text-emerald-600">✓ Verified from your case evidence</p>
                        )}
                        {/* CTA routing the user straight to where this task gets done. */}
                        {step.status !== "done" && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(step.actionKey.toUpperCase() === "REVIEW_ANALYSIS" || step.actionKey.toUpperCase() === "RERUN_ANALYSIS") ? (
                              <form action={reanalyzeCaseAction.bind(null, c.id)}>
                                <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                                  Re-run the analysis now →
                                </button>
                              </form>
                            ) : step.actionKey.toUpperCase() === "COMPLETE_FORM_9465" && form9465 ? (
                              <form action={startFormAction.bind(null, form9465.id)}>
                                <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                                  Start the payment plan form →
                                </button>
                              </form>
                            ) : stepCta(step.actionKey) ? (
                              <a
                                href={stepCta(step.actionKey)!.href}
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                              >
                                {stepCta(step.actionKey)!.label} →
                              </a>
                            ) : null}
                            {(step.actionKey.toUpperCase() === "GET_TRANSCRIPT" || step.actionKey.toUpperCase() === "GET_ACCOUNT_TRANSCRIPT") && (
                              <a
                                href="https://www.irs.gov/your-account"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Open IRS sign-up ↗
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Only steps we can't observe (e.g. "mail the letter") can be marked done by hand. */}
                      {!verifiable && step.status === "current" && (
                        <form action={completePathStepAction.bind(null, step.id)}>
                          <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                            I&apos;ve done this ✓
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
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

          <Card id="case-documents">
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
