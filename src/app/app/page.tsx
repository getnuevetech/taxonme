import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActivePlan } from "@/lib/access";
import { PageHeader, Card, CardBody, Stat, ButtonLink, StateMark, ProgressBar, Money, EmptyState, Badge } from "@/components/ui";
import { markNotificationReadAction } from "@/actions/user";
import { formatCaseNumber } from "@/lib/case-number";
import { formatSituationNumber } from "@/lib/situation";

export default async function DashboardPage() {
  const user = await requireUser();
  // Isolate each query — a missing migration or transient DB error must not white-screen /app.
  const emptyCases: Array<{
    id: string;
    number: number;
    title: string;
    status: string;
    readinessScore: number;
    issues: unknown[];
  }> = [];
  const emptySituations: Array<{
    id: string;
    number: number;
    title: string;
    status: string;
    updatedAt: Date;
  }> = [];
  let situationsUnavailable = false;
  const [cases, situations, issues, deadlines, notifications, plan] = await Promise.all([
    db.case
      .findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 5, include: { issues: true } })
      .catch(() => emptyCases),
    db.situation
      .findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, number: true, title: true, status: true, updatedAt: true },
      })
      .catch(() => {
        situationsUnavailable = true;
        return emptySituations;
      }),
    db.issue
      .findMany({ where: { case: { userId: user.id }, state: { not: "resolved" } } })
      .catch(() => [] as Array<{ id: string; state: string; differenceCents: number | null }>),
    db.deadline
      .findMany({ where: { userId: user.id, status: "open", dueDate: { gte: new Date() } }, orderBy: { dueDate: "asc" }, take: 5 })
      .catch(() => [] as Array<{ id: string; title: string; dueDate: Date }>),
    db.notification
      .findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 })
      .catch(() => [] as Array<{ id: string; title: string; body: string; link: string | null }>),
    getActivePlan(user.id).catch(() => null),
  ]);

  const soon = new Date();
  soon.setDate(soon.getDate() + 30);
  const approaching = deadlines.filter((d) => d.dueDate <= soon).length;
  const discrepancy = issues.reduce((sum, i) => sum + (i.differenceCents ?? 0), 0);
  const infoNeeded = issues.filter((i) => i.state === "info_needed").length;
  const avgReadiness = cases.length
    ? Math.round(cases.reduce((s, c) => s + c.readinessScore, 0) / cases.length)
    : 0;

  return (
    <div>
      <PageHeader
        title={`Hi${user.firstName ? ` ${user.firstName}` : ""}, here's your tax picture`}
        subtitle={plan ? `You're on the ${plan.name} plan` : undefined}
        actions={<ButtonLink href="/app/cases/new">Describe a situation →</ButtonLink>}
      />

      {notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-start justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-indigo-900">{n.title}</p>
                {n.body && <p className="text-sm text-indigo-700">{n.body}</p>}
                {n.link && (
                  <Link href={n.link} className="text-sm font-medium text-indigo-600 underline">
                    View →
                  </Link>
                )}
              </div>
              <form action={markNotificationReadAction.bind(null, n.id)}>
                <button className="text-xs text-indigo-400 hover:text-indigo-700">Dismiss</button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Issues identified" value={issues.length} sub={infoNeeded > 0 ? `${infoNeeded} need more info` : undefined} />
        <Stat label="Deadlines approaching" value={approaching} sub="next 30 days" />
        <Stat label="Amounts in question" value={<Money cents={discrepancy || null} />} sub="across open issues" />
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Case readiness</p>
            <div className="mt-2">
              <ProgressBar value={avgReadiness} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{avgReadiness}% · documents + verified facts − open questions</p>
          </CardBody>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Recent situations</h2>
            <Link href="/app/situations" className="text-xs font-medium text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {situationsUnavailable ? (
            <EmptyState
              title="Situations temporarily unavailable"
              body="We could not load Situations. Refresh after migrations finish."
            />
          ) : situations.length === 0 ? (
            <EmptyState
              title="No situations yet"
              body="Ask a tax question or explore options before anything is before the IRS."
              action={<ButtonLink href="/app/cases/new">Start exploring</ButtonLink>}
            />
          ) : (
            <div className="space-y-3">
              {situations.map((s) => (
                <Link key={s.id} href={`/app/situations/${s.id}`} className="block">
                  <Card className="transition hover:border-indigo-300">
                    <CardBody className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{s.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatSituationNumber(s.number)} · {s.status.replace(/_/g, " ")}
                        </p>
                      </div>
                      <Badge color="slate">{s.status.replace(/_/g, " ")}</Badge>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Recent cases</h2>
          {cases.length === 0 ? (
            <EmptyState
              title="No agency cases yet"
              body="Cases track matters already before the IRS or another tax agency. Explore a Situation first if you have not filed."
              action={<ButtonLink href="/app/situations">My situations</ButtonLink>}
            />
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <Link key={c.id} href={`/app/cases/${c.id}`} className="block">
                  <Card className="transition hover:border-indigo-300">
                    <CardBody className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{c.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatCaseNumber(c.number)} · {c.issues.length} issue{c.issues.length === 1 ? "" : "s"} · readiness {c.readinessScore}%
                        </p>
                      </div>
                      <Badge color={c.status === "analyzed" ? "green" : c.status === "consultant_recommended" ? "amber" : "slate"}>
                        {c.status.replace(/_/g, " ")}
                      </Badge>
                    </CardBody>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Upcoming deadlines</h2>
        {deadlines.length === 0 ? (
          <EmptyState title="Nothing due" body="Deadlines from notices and analyses appear here automatically." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {deadlines.map((d) => (
              <Card key={d.id}>
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{d.title}</p>
                    <p className="text-xs text-slate-500">{d.dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                  </div>
                  <StateMark state={d.dueDate <= soon ? "action_needed" : "review"} />
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
