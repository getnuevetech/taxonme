import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Stat, Card, CardBody, Badge } from "@/components/ui";
import { markNotificationReadAction } from "@/actions/user";

export const metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const admin = await guardAdminPage("admin.dashboard");
  const [users, consultantsPending, cases, needConsultant, activeSubs, providers, notifications, liveGateway] = await Promise.all([
    db.user.count({ where: { role: "user" } }),
    db.consultantProfile.count({ where: { status: "pending" } }),
    db.case.count(),
    db.case.count({ where: { status: "consultant_recommended" } }),
    db.subscription.count({ where: { status: { in: ["active", "trialing"] } } }),
    db.aiProvider.count({ where: { isEnabled: true, apiKey: { not: "" } } }),
    db.notification.findMany({ where: { userId: admin.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.paymentGatewayConfig.findFirst({ where: { isActive: true, mode: "live", kind: { not: "manual" } } }),
  ]);

  return (
    <div>
      <PageHeader title="Overview" subtitle="Platform health at a glance." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Registered users" value={users} />
        <Stat label="Active subscriptions" value={activeSubs} />
        <Stat label="Cases analyzed" value={cases} sub={`${needConsultant} flagged for consultant`} />
        <Stat label="Consultant applications" value={consultantsPending} sub="pending manual review" />
        <Stat label="Connected AI providers" value={providers} sub={providers === 0 ? "add providers to enable AI analysis" : "ready"} />
      </div>

      {providers === 0 && (
        <Card className="mt-6 border-amber-300">
          <CardBody>
            <p className="font-semibold text-slate-900">AI is not connected yet</p>
            <p className="mt-1 text-sm text-slate-600">
              The platform is running in deterministic fallback mode (rule-based analysis, labeled &ldquo;preliminary&rdquo; to users).
              Add 3–5 AI providers under{" "}
              <Link href="/admin/ai-providers" className="font-medium text-indigo-600 underline">AI providers</Link>, then assign them to
              analysis stages in <Link href="/admin/pipelines" className="font-medium text-indigo-600 underline">AI pipelines</Link>.
            </p>
          </CardBody>
        </Card>
      )}

      {!liveGateway && (
        <Card className="mt-6 border-amber-300">
          <CardBody>
            <p className="font-semibold text-slate-900">Payments are in test mode</p>
            <p className="mt-1 text-sm text-slate-600">
              No live payment gateway is active, so subscriptions activate without charging (the &ldquo;Manual / development&rdquo;
              gateway simulates payment). To charge real payments: open{" "}
              <Link href="/admin/payments" className="font-medium text-indigo-600 underline">Payment gateways</Link>, add your Stripe
              live keys (including <code className="rounded bg-slate-100 px-1">webhookSecret</code>, with the webhook endpoint set to{" "}
              <code className="rounded bg-slate-100 px-1">/api/webhooks/stripe</code> in the Stripe dashboard), set it to live and
              default, and deactivate the manual gateway.
            </p>
          </CardBody>
        </Card>
      )}

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
