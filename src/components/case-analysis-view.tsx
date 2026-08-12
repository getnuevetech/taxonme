import { db } from "@/lib/db";
import { Card, CardBody, StateMark, ConfidenceBadge, ProgressBar, Money, Badge } from "@/components/ui";
import { isVerifiable, VERIFIABLE_ACTIONS } from "@/lib/case-progress";
import { reanalyzeCaseAction, completePathStepAction, checkCaseProgressAction } from "@/actions/case";
import { startFormAction } from "@/actions/forms";
import { InlineUpload } from "@/components/inline-upload";
import { CaseUpload } from "@/components/case-upload";
import Link from "next/link";

export type CaseViewer = { role: "customer" | "consultant" | "admin"; userId: string; fullResults?: boolean };

// The single source of truth for how a case analysis is presented. Customers,
// consultants, and admins all see EXACTLY this view — only the available
// functions differ (customers act; consultants/admins read and comment).
export async function CaseAnalysisView({ caseId, viewer }: { caseId: string; viewer: CaseViewer }) {
  const c = await db.case.findUnique({
    where: { id: caseId },
    include: {
      issues: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      pathSteps: { orderBy: { sortOrder: "asc" } },
      documents: { where: { deletedAt: null } },
      runs: { orderBy: { startedAt: "desc" }, include: { consensus: true }, take: 10 },
    },
  });
  if (!c) return null;

  const interactive = viewer.role === "customer";
  const fullAccess = viewer.role !== "customer" ? true : (viewer.fullResults ?? true);
  const visibleIssues = fullAccess ? c.issues : c.issues.slice(0, 1);
  const verificationFlags = c.runs.filter((r) => r.consensus?.verificationRequired).length;
  const aiStepCount = await db.analysisStepResult.count({
    where: { run: { caseId: c.id }, status: "complete" },
  });
  const isPreliminary = c.runs.length > 0 && aiStepCount === 0;

  const form9465 = interactive
    ? await db.irsFormTemplate.findFirst({ where: { formNumber: "9465", isPublished: true }, select: { id: true } })
    : null;

  const stepCta = (actionKey: string): { label: string; href: string } | null => {
    switch (actionKey.toUpperCase()) {
      case "GET_TRANSCRIPT":
      case "GET_ACCOUNT_TRANSCRIPT":
        return { label: "How to get my transcript", href: "/app/irs-account" };
      case "DRAFT_LETTER":
        return { label: "Draft my letter", href: "/app/letters/new" };
      case "COMPLETE_FORM_9465":
        return { label: "Open the payment plan form", href: "/app/forms" };
      case "ADD_DEADLINE":
        return { label: "Add the deadline", href: "/app/deadlines" };
      default:
        return null;
    }
  };

  // Evidence checklist derived from the findings.
  const haveKinds = new Set(c.documents.map((d) => d.docKind));
  const yearHint = c.issues.find((i) => i.taxYear)?.taxYear;
  const neededDocs: { kind: string; label: string; hint: string }[] = [];
  const wantDoc = (kind: string, label: string, hint: string) => {
    if (!neededDocs.some((d) => d.kind === kind)) neededDocs.push({ kind, label, hint });
  };
  for (const issue of c.issues) {
    if (["refund_discrepancy", "balance_due", "penalty"].includes(issue.issueType)) {
      wantDoc("transcript", `IRS Account Transcript${yearHint ? ` (${yearHint})` : ""}`, "Downloads instantly from the IRS online account — settles the exact amounts.");
      wantDoc("1040", `Tax return (Form 1040)${yearHint ? ` for ${yearHint}` : ""}`, "Shows what was claimed, for comparison against IRS records.");
    }
    if (issue.issueType === "notice_response") {
      wantDoc("notice", "The IRS notice or letter itself", "A phone photo is fine — the notice number, amount, and deadline are printed on it.");
    }
    if (issue.issueType === "missing_return") {
      wantDoc("w2", "Income documents (W-2s)", "Needed to prepare the unfiled return.");
      wantDoc("1099", "Income documents (1099s)", "Freelance/interest/brokerage income forms.");
      wantDoc("transcript", "IRS Wage & Income Transcript", "Lists every income form the IRS received.");
    }
  }

  // Plain-English walkthrough of the latest analysis batch.
  const chronological = [...c.runs].reverse();
  const latestStart = c.runs[0]?.startedAt?.getTime() ?? 0;
  const latestBatch = chronological.filter((r) => latestStart - r.startedAt.getTime() < 5 * 60 * 1000);
  const money = (v: unknown) => (typeof v === "number" ? v.toLocaleString("en-US", { style: "currency", currency: "USD" }) : null);
  const describeRun = (run: (typeof latestBatch)[number]): string => {
    let merged: Record<string, unknown> = {};
    try {
      merged = JSON.parse(run.consensus?.mergedJson || "{}");
    } catch { /* empty */ }
    switch (run.stageKey) {
      case "summary": {
        const years = Array.isArray(merged.tax_years) ? (merged.tax_years as unknown[]).join(", ") : "";
        const notices = Array.isArray(merged.notices_received) ? (merged.notices_received as unknown[]).join(", ") : "";
        const parts = [
          years && `tax year(s) ${years}`,
          notices && `notice ${notices}`,
          money(merged.expected_refund) && `expected refund ${money(merged.expected_refund)}`,
          money(merged.received_refund) && `refund received ${money(merged.received_refund)}`,
          money(merged.balance_due) && `balance mentioned ${money(merged.balance_due)}`,
        ].filter(Boolean);
        return parts.length
          ? `Read the summary and pulled out the facts: ${parts.join(" · ")}.`
          : "Read the summary and recorded the key facts.";
      }
      case "goal":
        return "Interpreted the goal so every recommendation points at the requested outcome.";
      case "document":
        return `Cross-checked ${c.documents.length} document${c.documents.length === 1 ? "" : "s"} against the story, comparing amounts and dates.`;
      case "situation":
        return "Weighed the verified facts against IRS rules and procedures (payment plans, penalty relief, transcript codes) from the knowledge base.";
      case "presenter":
        return "Assembled everything into the findings and step-by-step plan on this page.";
      default:
        return `Completed the ${run.stageKey.replace(/_/g, " ")} check.`;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {isPreliminary && (
          <div className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700">
            <span className="font-semibold">? Preliminary review.</span> These results come from rule-based checks of the
            answers and readable documents. Full multi-model AI verification runs automatically once the platform&apos;s AI
            providers are connected.
          </div>
        )}
        {c.status === "consultant_recommended" && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <span className="font-semibold">▲ Professional review recommended.</span> Based on the analysis, this case would benefit
            from a licensed professional.
          </div>
        )}
        {verificationFlags > 0 && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <span className="font-semibold">◐ Verification required.</span> Analysis engines disagreed on some values — flagged
            instead of guessed. More documents (like the IRS account transcript) resolve this.
          </div>
        )}

        {latestBatch.length > 0 && (
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">How we analyzed this case</h2>
            <Card>
              <CardBody>
                <p className="mb-3 text-xs text-slate-500">
                  Last analyzed {c.runs[0].startedAt.toLocaleString("en-US")} · summary, goal, and{" "}
                  {c.documents.length} document{c.documents.length === 1 ? "" : "s"} examined. Every upload is checked against{" "}
                  <span className="font-medium">every</span> finding and re-runs the analysis automatically.
                </p>
                <ol className="space-y-3">
                  {latestBatch.map((run, i) => (
                    <li key={run.id} className="flex gap-3">
                      <span className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                      <div>
                        <p className="text-sm leading-relaxed text-slate-700">
                          <span className="font-semibold text-slate-900">{i + 1}.</span> {describeRun(run)}
                        </p>
                        {run.consensus?.verificationRequired && (
                          <p className="text-xs font-medium text-amber-600">◐ Some values disagreed — flagged for verification instead of guessing.</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-semibold">Result:</span> {c.issues.length} finding{c.issues.length === 1 ? "" : "s"} below, each
                  with its own detailed walkthrough, tailored outcome, and next step · case readiness {c.readinessScore}%.
                </p>
              </CardBody>
            </Card>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">What we found</h2>
          <div className="space-y-4">
            {visibleIssues.length === 0 && (
              <Card><CardBody className="text-sm text-slate-500">The analysis is still in progress or found nothing actionable yet.</CardBody></Card>
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
                  {issue.irsBasis && <p className="mt-2 text-xs text-slate-400">IRS basis: {issue.irsBasis}</p>}

                  {(() => {
                    let outline: { heading: string; detail: string }[] = [];
                    try {
                      const parsed = JSON.parse(issue.evidenceJson || "[]");
                      if (Array.isArray(parsed)) outline = parsed.filter((o) => o?.heading && o?.detail);
                    } catch { /* legacy issues */ }
                    if (outline.length === 0) return null;
                    return (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">How we reached this finding</p>
                        <ol className="space-y-3">
                          {outline.map((o, oi) => (
                            <li key={oi} className="grid gap-1 sm:grid-cols-[180px_1fr] sm:gap-4">
                              <p className="text-sm font-semibold text-slate-800">
                                <span className="mr-1.5 font-mono text-xs text-indigo-500">{String(oi + 1).padStart(2, "0")}</span>
                                {o.heading}
                              </p>
                              <p className="text-sm leading-relaxed text-slate-600">{o.detail}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    );
                  })()}

                  {issue.nextAction && issue.state !== "resolved" && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-indigo-50 px-3 py-2.5">
                      <p className="text-sm font-medium text-indigo-800">
                        Next step: {issue.nextAction.replace(/_/g, " ").toLowerCase()}
                      </p>
                      {interactive && (
                        issue.nextAction.toUpperCase() === "UPLOAD_DOCUMENTS" ? (
                          <InlineUpload caseId={c.id} label="Upload for this finding" />
                        ) : (
                          <>
                            {stepCta(issue.nextAction) && (
                              <a href={stepCta(issue.nextAction)!.href} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                                {stepCta(issue.nextAction)!.label} →
                              </a>
                            )}
                            {["GET_TRANSCRIPT", "GET_ACCOUNT_TRANSCRIPT"].includes(issue.nextAction.toUpperCase()) && (
                              <>
                                <a href="https://www.irs.gov/your-account" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                                  Open IRS sign-up ↗
                                </a>
                                <InlineUpload caseId={c.id} docKind="transcript" label="Have it? Upload transcript" />
                              </>
                            )}
                          </>
                        )
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
            {interactive && !fullAccess && c.issues.length > 1 && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 text-center">
                <p className="font-semibold text-indigo-900">
                  {c.issues.length - 1} more finding{c.issues.length - 1 === 1 ? "" : "s"} in your full analysis
                </p>
                <p className="mt-1 text-sm text-indigo-700">Upgrade your plan to unlock every finding, amount, and step.</p>
                <div className="mt-4">
                  <Link href="/app/billing" className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">See plans →</Link>
                </div>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Path forward</h2>
            {interactive && (
              <form action={checkCaseProgressAction.bind(null, c.id)}>
                <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  ↻ Check my progress
                </button>
              </form>
            )}
          </div>
          <Card>
            <CardBody className="space-y-1">
              {c.pathSteps.map((step, i) => {
                const verifiable = isVerifiable(step.actionKey);
                return (
                  <div key={step.id} className={`flex items-start gap-3 rounded-xl p-3 ${step.status === "current" ? "bg-indigo-50" : ""}`}>
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      step.status === "done" ? "bg-emerald-100 text-emerald-700" : step.status === "current" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      {step.status === "done" ? "✓" : i + 1}
                    </span>
                    <div className="flex-1">
                      <p className={`font-medium ${step.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>{step.title}</p>
                      <p className="text-sm text-slate-500">{step.description}</p>
                      {verifiable && step.status !== "done" && (
                        <p className="mt-1 text-xs font-medium text-indigo-600">
                          ◐ Verified automatically — {VERIFIABLE_ACTIONS[step.actionKey.toUpperCase()].toLowerCase()}
                        </p>
                      )}
                      {verifiable && step.status === "done" && (
                        <p className="mt-1 text-xs font-medium text-emerald-600">✓ Verified from case evidence</p>
                      )}
                      {interactive && step.status !== "done" && (
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
                          ) : step.actionKey.toUpperCase() === "UPLOAD_DOCUMENTS" ? (
                            <InlineUpload caseId={c.id} label="Upload documents" />
                          ) : stepCta(step.actionKey) ? (
                            <a href={stepCta(step.actionKey)!.href} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                              {stepCta(step.actionKey)!.label} →
                            </a>
                          ) : null}
                          {(step.actionKey.toUpperCase() === "GET_TRANSCRIPT" || step.actionKey.toUpperCase() === "GET_ACCOUNT_TRANSCRIPT") && (
                            <a href="https://www.irs.gov/your-account" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                              Open IRS sign-up ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    {interactive && !verifiable && step.status === "current" && (
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
            <h3 className="text-sm font-semibold text-slate-900">Goal</h3>
            <p className="mt-1 text-sm text-slate-600">{c.goal || "No goal recorded."}</p>
          </CardBody>
        </Card>

        {neededDocs.length > 0 && (
          <Card>
            <CardBody>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Documents we still need</h3>
              <ul className="space-y-2.5">
                {neededDocs.map((d) => {
                  const have = haveKinds.has(d.kind);
                  return (
                    <li key={d.kind} className="flex items-start gap-2.5">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${have ? "bg-emerald-100 text-emerald-700" : "border-2 border-dashed border-slate-300 text-transparent"}`}>
                        ✓
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${have ? "text-slate-400 line-through" : "text-slate-800"}`}>{d.label}</p>
                        {!have && <p className="text-xs text-slate-500">{d.hint}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {interactive && neededDocs.some((d) => !haveKinds.has(d.kind)) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <InlineUpload caseId={c.id} label="Upload now" />
                  {neededDocs.some((d) => d.kind === "transcript" && !haveKinds.has("transcript")) && (
                    <a href="/app/irs-account" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Transcript guide →
                    </a>
                  )}
                </div>
              )}
              <p className="mt-2 text-[10px] text-slate-400">Every document added is checked against all findings automatically.</p>
            </CardBody>
          </Card>
        )}

        <Card id="case-documents">
          <CardBody>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Case documents ({c.documents.length})</h3>
            <ul className="space-y-1.5">
              {c.documents.map((d) => (
                <li key={d.id}>
                  <a href={`/api/files/${d.id}`} target="_blank" className="text-sm text-indigo-600 underline">
                    {d.fileName}
                  </a>{" "}
                  <Badge>{d.docKind}</Badge>
                </li>
              ))}
              {c.documents.length === 0 && <li className="text-sm text-slate-400">None yet.</li>}
            </ul>
            {interactive && (
              <div className="mt-3">
                <CaseUpload caseId={c.id} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
