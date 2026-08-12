import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, EmptyState, ButtonLink, StateMark, ProgressBar } from "@/components/ui";
import { consultantRespondAssignmentAction } from "@/actions/consultant";
import { formatCaseNumber } from "@/lib/case-number";
import { caseRoutingReason } from "@/lib/matching";

function money(cents: number | null): string | null {
  if (cents === null || cents === undefined) return null;
  return `$${(Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export const metadata = { title: "Consultant dashboard" };

export default async function ConsultantDashboard({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
  const user = await requireUser();
  const { consultantSubscriptionsEnabled, hasActiveConsultantSubscription } = await import("@/lib/payments");
  const subsEnabled = await consultantSubscriptionsEnabled();
  const needsSubscription = subsEnabled && !(await hasActiveConsultantSubscription(user.id));
  const profile = await db.consultantProfile.findUnique({ where: { userId: user.id } });
  const mySpecialties: string[] = profile ? JSON.parse(profile.specialties || "[]") : [];
  const caseInclude = {
    issues: { orderBy: { createdAt: "asc" as const } },
    pathSteps: { orderBy: { sortOrder: "asc" as const } },
    _count: { select: { documents: true } },
  };
  const assignments = await db.consultantAssignment.findMany({
    where: { consultantId: user.id, status: { notIn: ["revoked", "declined"] } },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          cases: { orderBy: { updatedAt: "desc" as const }, take: 1, include: caseInclude },
        },
      },
      case: { include: caseInclude },
    },
  });
  const agreement = await db.contentPage.findFirst({
    where: { kind: "agreement_connection", isPublished: true },
    select: { slug: true, title: true },
  });

  return (
    <div>
      <PageHeader title="Your practice" subtitle={`Welcome, ${user.firstName || user.email}`} />

      {submitted && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Application received. {profile?.status === "approved" ? "You're approved and ready to accept clients." : "Our team reviews applications manually — we'll notify you."}
        </div>
      )}

      {needsSubscription && (
        <Card className="mb-6 border-amber-300">
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">Partner subscription required</p>
              <p className="text-sm text-slate-500">An active partner plan is required to accept new client assignments.</p>
            </div>
            <ButtonLink href="/consultant/billing">See partner plans →</ButtonLink>
          </CardBody>
        </Card>
      )}

      {!profile && (
        <Card className="mb-6 border-amber-300">
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">Complete your professional onboarding</p>
              <p className="text-sm text-slate-500">We need your credentials, proof, and specialties before you can be assigned clients.</p>
            </div>
            <ButtonLink href="/consultant/onboarding">Start onboarding →</ButtonLink>
          </CardBody>
        </Card>
      )}

      {profile && (
        <Card className="mb-6">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Account status</p>
              <p className="font-semibold capitalize text-slate-900">{profile.status}{profile.autoApproved ? " (auto-approved)" : ""}</p>
              {profile.status === "pending" && <p className="text-xs text-slate-400">An administrator reviews every application manually.</p>}
              {profile.status === "rejected" && profile.rejectionReason && (
                <p className="text-xs text-red-500">Reason: {profile.rejectionReason}</p>
              )}
            </div>
            <Badge color={profile.status === "approved" ? "green" : profile.status === "rejected" ? "red" : "amber"}>
              {profile.credentialType.toUpperCase().replace("_", " ")}
            </Badge>
          </CardBody>
        </Card>
      )}

      <h2 className="mb-3 text-base font-semibold text-slate-900">Client assignments</h2>
      {assignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          body="When our team matches you with a client whose situation fits your specialties, the proposal appears here. Both you and the client must agree before anything is shared."
        />
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const kase = a.case ?? a.user.cases[0] ?? null;
            const openIssues = kase ? kase.issues.filter((i) => i.state !== "resolved") : [];
            const doneSteps = kase ? kase.pathSteps.filter((s) => s.status === "done").length : 0;
            const nextStep = kase ? kase.pathSteps.find((s) => s.status !== "done") : null;
            const routingReason = kase && kase.issues.length > 0
              ? caseRoutingReason(kase.issues.map((i) => i.issueType), mySpecialties)
              : null;
            return (
            <Card key={a.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{a.user.firstName} {a.user.lastName}</p>
                    <p className="text-sm text-slate-500">{a.status === "active" ? a.user.email : "Contact details unlock when the connection is active"}</p>
                  </div>
                  <Badge color={a.status === "active" ? "green" : "amber"}>{a.status.replace(/_/g, " ")}</Badge>
                </div>

                {kase ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        <span className="mr-2 font-mono text-xs text-indigo-600">{formatCaseNumber(kase.number)}</span>
                        {kase.title}
                      </p>
                      <Badge>{kase.status.replace(/_/g, " ")}</Badge>
                    </div>
                    {kase.goal && (
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-medium text-slate-700">Client&apos;s goal: </span>
                        {kase.goal}
                      </p>
                    )}

                    {kase.issues.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          What our analysis found ({kase.issues.length} issue{kase.issues.length === 1 ? "" : "s"})
                        </p>
                        <div className="mt-2 space-y-1.5">
                          {kase.issues.map((i) => (
                            <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-100">
                              <span className="text-slate-700">
                                {i.taxYear ? `${i.taxYear} · ` : ""}{i.title}
                                {money(i.differenceCents) ? <span className="ml-1.5 font-semibold text-indigo-600">{money(i.differenceCents)}</span> : null}
                              </span>
                              <StateMark state={i.state} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">Analysis hasn&apos;t surfaced findings yet — the client may still be adding details.</p>
                    )}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <ProgressBar value={kase.readinessScore} label="Case readiness" />
                      <div className="text-sm text-slate-600">
                        <p>
                          <span className="font-medium text-slate-700">{doneSteps}/{kase.pathSteps.length}</span> path steps done
                          <span className="mx-1.5 text-slate-300">·</span>
                          <span className="font-medium text-slate-700">{kase._count.documents}</span> document{kase._count.documents === 1 ? "" : "s"} shared
                        </p>
                        {openIssues.length > 0 && (
                          <p className="mt-0.5 text-xs text-slate-500">{openIssues.length} finding{openIssues.length === 1 ? "" : "s"} awaiting professional review</p>
                        )}
                      </div>
                    </div>
                    {nextStep && (
                      <p className="mt-2 text-sm text-slate-600">
                        <span className="font-medium text-slate-700">Where the case stands: </span>
                        {nextStep.title}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">This client hasn&apos;t started a case yet — you&apos;ll see the full analysis briefing here once they do.</p>
                )}

                {routingReason && (
                  <p className="mt-3 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Why this case was routed to you: </span>
                    {routingReason}
                  </p>
                )}

                {!a.consultantAgreedAt && a.status !== "active" && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      Accepting means you agree to the{" "}
                      {agreement ? (
                        <a href={`/p/${agreement.slug}`} target="_blank" className="font-medium text-indigo-600 underline">{agreement.title}</a>
                      ) : ("connection agreement")}{" "}
                      covering confidentiality and handling of the client&apos;s sensitive materials.
                    </p>
                    <div className="mt-3 flex gap-2">
                      {needsSubscription ? (
                        <ButtonLink href="/consultant/billing?required=1">Subscribe to accept clients →</ButtonLink>
                      ) : (
                        <form action={consultantRespondAssignmentAction.bind(null, a.id, true)}>
                          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                            Accept assignment
                          </button>
                        </form>
                      )}
                      <form action={consultantRespondAssignmentAction.bind(null, a.id, false)}>
                        <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                          Decline
                        </button>
                      </form>
                    </div>
                  </div>
                )}
                {a.consultantAgreedAt && !a.userAgreedAt && (
                  <p className="mt-3 text-sm text-slate-500">You&apos;ve accepted. Waiting for the client to approve the connection.</p>
                )}
                {a.status === "active" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {kase && (
                      <Link
                        href={`/consultant/clients/${a.id}/cases/${kase.id}`}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Review full analysis →
                      </Link>
                    )}
                    <Link
                      href={`/consultant/clients/${a.id}`}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Client workspace
                    </Link>
                  </div>
                )}
              </CardBody>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
