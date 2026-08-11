import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { GatewayForm } from "@/components/admin/gateway-form";
import { deleteGatewayAction } from "@/actions/admin";

export const metadata = { title: "Payment gateways" };

export default async function AdminPaymentsPage() {
  await guardAdminPage("admin.payments");
  const gateways = await db.paymentGatewayConfig.findMany({ orderBy: { updatedAt: "desc" } });
  const { getSetting } = await import("@/lib/settings");
  const appUrl = (await getSetting("app.url", "http://localhost:3000")).replace(/\/$/, "");

  return (
    <div>
      <PageHeader
        title="Payment gateways"
        subtitle="Integrate payment and subscription APIs here. All keys and settings live in this configuration — nothing is hardcoded."
        actions={
          <Link href="/admin/transactions" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            View transactions →
          </Link>
        }
      />
      <Card className="mb-6 border-indigo-200">
        <CardBody>
          <h2 className="text-sm font-semibold text-slate-900">Stripe webhook endpoint</h2>
          <p className="mt-1 text-xs text-slate-500">
            In the Stripe dashboard → Developers → Webhooks, add this endpoint and subscribe to{" "}
            <code className="rounded bg-slate-100 px-1">checkout.session.completed</code>,{" "}
            <code className="rounded bg-slate-100 px-1">invoice.payment_failed</code>, and{" "}
            <code className="rounded bg-slate-100 px-1">customer.subscription.deleted</code>. Put the signing secret in the
            Stripe gateway config below as <code className="rounded bg-slate-100 px-1">webhookSecret</code>. Every checkout also
            carries our TXN reference in Stripe metadata for end-to-end tracing. (Payments confirm even without the webhook —
            the app reconciles with Stripe directly — but webhooks make it instant and cover renewals/cancellations.)
          </p>
          <p className="mt-2 select-all rounded-lg bg-slate-900 px-3 py-2 font-mono text-sm text-emerald-300">
            {appUrl}/api/webhooks/stripe
          </p>
          {appUrl.includes("localhost") && (
            <p className="mt-1 text-xs text-amber-600">
              Note: your App URL is currently localhost — Stripe can&apos;t reach it. Set your public App URL in Settings once deployed.
            </p>
          )}
        </CardBody>
      </Card>

      <div className="space-y-6">
        {gateways.map((g) => (
          <Card key={g.id}>
            <CardBody>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="font-semibold text-slate-900">{g.name}</h2>
                <Badge>{g.kind}</Badge>
                <Badge color={g.mode === "live" ? "green" : "amber"}>{g.mode}</Badge>
                {g.isDefault && <Badge color="indigo">default</Badge>}
                {!g.isActive && <Badge color="red">inactive</Badge>}
              </div>
              <GatewayForm
                gateway={{ id: g.id, name: g.name, kind: g.kind, mode: g.mode, isActive: g.isActive, isDefault: g.isDefault, configJson: g.configJson }}
              />
              <form action={deleteGatewayAction.bind(null, g.id)} className="mt-2 text-right">
                <button className="text-xs font-medium text-red-500 hover:text-red-700">Remove gateway</button>
              </form>
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardBody>
            <h2 className="mb-3 font-semibold text-slate-900">Add a gateway</h2>
            <GatewayForm gateway={null} />
          </CardBody>
        </Card>
      </div>

    </div>
  );
}
