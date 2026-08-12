import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { KpiCard, BarSeries, Donut, HBars } from "@/components/admin/charts";
import { getAdminAnalytics } from "@/lib/admin-analytics";
import { markNotificationReadAction } from "@/actions/user";

export const metadata = { title: "Analytics dashboard" };

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default async function AdminOverviewPage() {
  const admin = await guardAdminPage("admin.dashboard");
  const [a, notifications, liveGateway] = await Promise.all([
    getAdminAnalytics(),
    db.notification.findMany({ where: { userId: admin.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.paymentGatewayConfig.findFirst({ where: { isActive: true, mode: "live", kind: { not: "manual" } } }),
  ]);

  return (
    <div>
      <PageHeader title="Analytics dashboard" subtitle="The entire platform at a glance — people, money, cases, support, and the AI engine." />

      {/* Operational alerts */}
      {(a.engine.providers === 0 || !liveGateway || a.engine.aiCallsFailed > 0) && (
        <div className="mb-6 space-y-2">
          {a.engine.providers === 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              AI not connected — analyses run in rule-based mode. <Link href="/admin/ai-providers" className="font-semibold underline">Add providers</Link>.
            </div>
          )}
          {a.engine.aiCallsFailed > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
              {a.engine.aiCallsFailed} failed AI model call{a.engine.aiCallsFailed === 1 ? "" : "s"} recorded — check provider keys/models in{" "}
              <Link href="/admin/ai-providers" className="font-semibold underline">AI providers</Link> and per-case diagnostics.
            </div>
          )}
          {!liveGateway && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              Payments in test mode — subscriptions activate without charging. <Link href="/admin/payments" className="font-semibold underline">Configure a live gateway</Link>.
            </div>
          )}
        </div>
      )}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Customers" value={String(a.users.customersTotal)} delta={a.users.customersDelta} sub={`${a.users.customersNew30} new in 30d`} />
        <KpiCard label="MRR" value={usd(a.revenue.mrrCents)} sub={`${a.revenue.activeSubscriptions} active subscription${a.revenue.activeSubscriptions === 1 ? "" : "s"}`} />
        <KpiCard label="Revenue (30d)" value={usd(a.revenue.last30Cents)} delta={Math.round((a.revenue.last30Cents - a.revenue.prev30Cents) / 100)} deltaLabel="$ vs prior 30d" sub={`${usd(a.revenue.totalCents)} all-time`} />
        <KpiCard label="Cases" value={String(a.cases.total)} sub={`avg readiness ${a.cases.avgReadiness}%`} />
        <KpiCard label="Open tickets" value={String(a.tickets.open)} sub={a.tickets.avgFirstResponseHours !== null ? `first response ~${a.tickets.avgFirstResponseHours}h` : "no responses yet"} />
        <KpiCard label="CSAT" value={a.tickets.csatAvg !== null ? `${a.tickets.csatAvg}/5` : "—"} sub={`${a.tickets.csatCount} rating${a.tickets.csatCount === 1 ? "" : "s"}`} />
      </div>

      {/* Trends */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card><CardBody>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Signups — last 30 days</h3>
          <BarSeries data={a.users.signupSeries} />
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Cases opened — last 30 days</h3>
          <BarSeries data={a.cases.caseSeries} color="#0ea5e9" />
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Revenue — last 30 days ($)</h3>
          <BarSeries data={a.revenue.revenueSeries} color="#10b981" valueFormat={(v) => `$${v}`} />
        </CardBody></Card>
      </div>

      {/* Distributions */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card><CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Active plan mix</h3>
          <Donut segments={a.revenue.planMix} centerLabel="active subs" centerValue={String(a.revenue.activeSubscriptions)} />
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Cases by status</h3>
          <Donut segments={a.cases.byStatus} centerLabel="cases" centerValue={String(a.cases.total)} />
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Tickets by status</h3>
          <Donut segments={a.tickets.byStatus} centerLabel="queues" centerValue={String(a.tickets.byQueue.reduce((s, q) => s + q.value, 0))} />
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Transactions by status</h3>
          <Donut segments={a.revenue.txByStatus} centerLabel="transactions" centerValue={String(a.revenue.txByStatus.reduce((s, t) => s + t.value, 0))} />
        </CardBody></Card>
      </div>

      {/* Deep dives */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card><CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Findings by issue type</h3>
          <HBars data={a.cases.issuesByType} />
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">AI engine</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Connected providers</dt><dd className="font-semibold text-slate-900">{a.engine.providers}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Analysis runs (AI / total)</dt><dd className="font-semibold text-slate-900">{a.engine.runsWithAi} / {a.engine.runsTotal}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Model calls succeeded</dt><dd className="font-semibold text-emerald-600">{a.engine.aiCallsOk}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Model calls failed</dt><dd className={`font-semibold ${a.engine.aiCallsFailed > 0 ? "text-red-600" : "text-slate-900"}`}>{a.engine.aiCallsFailed}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Call success rate</dt><dd className="font-semibold text-slate-900">{a.engine.callSuccessRate !== null ? `${a.engine.callSuccessRate}%` : "—"}</dd></div>
          </dl>
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Consultant network</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-600">Consultants (approved)</dt><dd className="font-semibold text-slate-900">{a.users.consultantsTotal} ({a.users.consultantsApproved})</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Applications pending</dt><dd className={`font-semibold ${a.users.consultantsPending > 0 ? "text-amber-600" : "text-slate-900"}`}>{a.users.consultantsPending}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">AI auto-assignments</dt><dd className="font-semibold text-slate-900">{a.consultantsOps.autoAssigned}</dd></div>
          </dl>
          <div className="mt-3">
            <HBars data={a.consultantsOps.assignmentsByStatus} />
          </div>
        </CardBody></Card>
      </div>

      {/* Activity & people counters */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card><CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Product activity</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Documents in vaults", value: a.content.docsCount },
              { label: "Forms completed", value: a.content.formsCompleted },
              { label: "Letters drafted", value: a.content.lettersCount },
              { label: "Notices explained", value: a.content.noticesCount },
              { label: "Q&A questions", value: a.content.qaMessages },
              { label: "Guide conversations", value: a.content.guideThreads },
              { label: "System messages sent", value: a.content.messagesSent },
              { label: "…of which emailed", value: a.content.messagesEmailed },
            ].map((x) => (
              <div key={x.label} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xl font-bold text-slate-900">{x.value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{x.label}</p>
              </div>
            ))}
          </div>
        </CardBody></Card>
        <Card><CardBody>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">People & support</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Admin users", value: a.users.adminCount },
              { label: "Suspended accounts", value: a.users.suspended },
              { label: "Deleted (retained)", value: a.users.deleted },
              { label: "Tickets total", value: a.tickets.byStatus.reduce((s, t) => s + t.value, 0) },
            ].map((x) => (
              <div key={x.label} className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-xl font-bold text-slate-900">{x.value}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">{x.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Ticket queues</h4>
            <HBars data={a.tickets.byQueue} />
          </div>
        </CardBody></Card>
      </div>

      {/* Notifications */}
      <div className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Notifications</h2>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing needs your attention.</p>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <Card key={n.id}>
                <CardBody className="flex items-start justify-between gap-3 !p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                      <Badge color={n.kind === "consultant_needed" ? "amber" : "slate"}>{n.kind.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-sm text-slate-500">{n.body}</p>
                    {n.link && <Link href={n.link} className="text-sm font-medium text-indigo-600 underline">Open →</Link>}
                  </div>
                  <form action={markNotificationReadAction.bind(null, n.id)}>
                    <button className="text-xs text-slate-400 hover:text-slate-700">Dismiss</button>
                  </form>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
