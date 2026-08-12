import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, EmptyState } from "@/components/ui";
import { PlanPicker } from "@/components/plan-picker";
import { cancelSubscriptionAction } from "@/actions/billing";
import { consultantSubscriptionsEnabled, reconcilePendingStripeTransactions } from "@/lib/payments";

export const metadata = { title: "Partner plan & billing" };

export default async function ConsultantBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; pending?: string; canceled?: string }>;
}) {
  const { subscribed, pending } = await searchParams;
  const user = await requireUser();
  const enabled = await consultantSubscriptionsEnabled();
  const justActivated = await reconcilePendingStripeTransactions(user.id);

  const [plans, subscription] = await Promise.all([
    db.subscriptionPlan.findMany({
      where: { isActive: true, audience: "consultant" },
      orderBy: { sortOrder: "asc" },
      include: { features: { where: { enabled: true }, include: { feature: true } } },
    }),
    db.subscription.findFirst({
      where: {
        userId: user.id,
        status: { in: ["active", "trialing"] },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    }),
  ]);
  const { getPlanDiscounts } = await import("@/lib/discounts");
  const discounts = await getPlanDiscounts(plans.map((p) => p.id), user.email);

  if (!enabled) {
    return (
      <div>
        <PageHeader title="Partner plan & billing" />
        <EmptyState
          title="No subscription required right now"
          body="Partner subscriptions are currently disabled — you can receive and accept client assignments at no cost. If this changes, you'll see the available plans here."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Partner plan & billing"
        subtitle="An active partner plan is required to accept new client assignments."
      />
      {(subscribed || justActivated) && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Your partner plan is active — you can accept client assignments.
        </div>
      )}
      {pending && !justActivated && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          Payment received — your plan activates as soon as the payment processor confirms it. Refresh shortly.
        </div>
      )}

      <Card className="mb-8">
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Current partner plan</p>
            <p className="text-xl font-bold text-slate-900">{subscription?.plan.audience === "consultant" ? subscription.plan.name : "None"}</p>
            {subscription?.plan.audience === "consultant" && subscription.currentPeriodEnd && (
              <p className="text-xs text-slate-400">Renews {subscription.currentPeriodEnd.toLocaleDateString("en-US")}</p>
            )}
          </div>
          {subscription?.plan.audience === "consultant" && (
            <form action={cancelSubscriptionAction}>
              <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel subscription
              </button>
            </form>
          )}
        </CardBody>
      </Card>

      {plans.length === 0 ? (
        <EmptyState title="No partner plans published yet" body="The team is preparing partner plans — check back soon." />
      ) : (
        <PlanPicker
          discounts={discounts}
          currentPlanId={subscription?.plan.audience === "consultant" ? subscription.planId : ""}
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
      )}
    </div>
  );
}
