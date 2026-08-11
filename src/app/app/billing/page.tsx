import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getActivePlan } from "@/lib/access";
import { PageHeader, Card, CardBody, Badge, Money } from "@/components/ui";
import { cancelSubscriptionAction } from "@/actions/billing";
import { PlanPicker } from "@/components/plan-picker";

export const metadata = { title: "Plan & billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; canceled?: string; pending?: string }>;
}) {
  const { subscribed, pending } = await searchParams;
  const user = await requireUser();
  // Confirm any in-flight Stripe checkout directly with Stripe — no webhook required.
  const { reconcilePendingStripeTransactions } = await import("@/lib/payments");
  const justActivated = await reconcilePendingStripeTransactions(user.id);
  const [currentPlan, plans, subscription, transactions, activeGateway] = await Promise.all([
    getActivePlan(user.id),
    db.subscriptionPlan.findMany({
      where: { isActive: true, audience: "customer" },
      orderBy: { sortOrder: "asc" },
      include: { features: { where: { enabled: true }, include: { feature: true } } },
    }),
    db.subscription.findFirst({
      where: { userId: user.id, status: { in: ["active", "trialing"] } },
      orderBy: { createdAt: "desc" },
    }),
    db.paymentTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.paymentGatewayConfig.findFirst({ where: { isActive: true }, orderBy: [{ isDefault: "desc" }] }),
  ]);
  const isTestGateway = !activeGateway || activeGateway.kind === "manual" || activeGateway.mode === "test";

  return (
    <div>
      <PageHeader title="Plan & billing" subtitle="Upgrade or downgrade anytime. Access changes immediately." />
      {(subscribed || justActivated) && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your plan is active. Enjoy your new features!
        </div>
      )}
      {pending && !justActivated && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Payment received — your plan activates as soon as the payment processor confirms it (usually within a
          minute). Refresh this page shortly.
        </div>
      )}
      {isTestGateway && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Test mode.</span> Payments are currently simulated
          {activeGateway ? ` (gateway: ${activeGateway.name})` : " (no payment gateway configured)"} — subscriptions
          activate without charging a card. A live payment gateway can be connected in the admin backend.
        </div>
      )}
      <Card className="mb-8">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Current plan</p>
            <p className="text-xl font-bold text-slate-900">{currentPlan?.name ?? "Free"}</p>
            {subscription?.currentPeriodEnd && (
              <p className="text-xs text-slate-400">Renews {subscription.currentPeriodEnd.toLocaleDateString("en-US")}</p>
            )}
          </div>
          {subscription && (
            <form action={cancelSubscriptionAction}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel subscription
              </button>
            </form>
          )}
        </CardBody>
      </Card>

      <PlanPicker
        currentPlanId={currentPlan?.id ?? ""}
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          badge: p.badge,
          priceMonthlyCents: p.priceMonthlyCents,
          priceYearlyCents: p.priceYearlyCents,
          features: p.features
            .sort((a, b) => a.feature.sortOrder - b.feature.sortOrder)
            .map((f) => ({ name: f.feature.name, limit: f.limitValue })),
        }))}
      />

      {transactions.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Payment history</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 text-slate-600">{t.createdAt.toLocaleDateString("en-US")}</td>
                    <td className="px-4 py-3 font-medium text-slate-900"><Money cents={t.amountCents} /></td>
                    <td className="px-4 py-3 text-slate-500">{t.gateway}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge color={t.status === "succeeded" ? "green" : t.status === "failed" ? "red" : "slate"}>{t.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
