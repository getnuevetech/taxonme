import { db } from "@/lib/db";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { Card, CardBody, ButtonLink, Badge } from "@/components/ui";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const plans = await db.subscriptionPlan.findMany({
    where: { isActive: true, audience: "customer" },
    orderBy: { sortOrder: "asc" },
    include: { features: { where: { enabled: true }, include: { feature: true } } },
  });
  const { getPlanDiscounts, applyDiscount } = await import("@/lib/discounts");
  // Public page: only general (everyone) discounts show here.
  const discounts = await getPlanDiscounts(plans.map((p) => p.id), null);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-slate-900">Simple pricing, serious help</h1>
          <p className="mt-2 text-slate-600">Start free. Upgrade when you want the full toolkit.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => {
            const deal = discounts[plan.id];
            const monthly = applyDiscount(plan.priceMonthlyCents, deal);
            const onSale = Boolean(deal) && monthly < plan.priceMonthlyCents;
            return (
            <Card key={plan.id} className={onSale ? "relative ring-2 ring-emerald-500" : plan.badge ? "ring-2 ring-indigo-500" : ""}>
              <CardBody className="flex h-full flex-col">
                {onSale && (
                  <span className="absolute -top-3 left-4 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-bold text-white shadow">
                    {deal!.name}{deal!.percentOff > 0 ? ` · ${deal!.percentOff}% off` : ""}
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                  {plan.badge && <Badge color="indigo">{plan.badge}</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <p className="mt-4">
                  {onSale && (
                    <span className="mr-2 text-lg font-semibold text-slate-400 line-through">
                      ${(plan.priceMonthlyCents / 100).toFixed(0)}
                    </span>
                  )}
                  <span className={`text-3xl font-extrabold ${onSale ? "text-emerald-600" : "text-slate-900"}`}>
                    ${(monthly / 100).toFixed(0)}
                  </span>
                  <span className="text-sm text-slate-500">/month</span>
                  {plan.priceYearlyCents > 0 && (
                    <span className="ml-2 text-xs text-slate-400">
                      or ${(applyDiscount(plan.priceYearlyCents, deal) / 100).toFixed(0)}/year
                    </span>
                  )}
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-600">
                  {plan.features
                    .sort((a, b) => a.feature.sortOrder - b.feature.sortOrder)
                    .map((pf) => (
                      <li key={pf.id} className="flex items-start gap-2">
                        <span className="mt-0.5 font-bold text-emerald-600">✓</span>
                        <span>
                          {pf.feature.name}
                          {pf.limitValue !== null && (
                            <span className="text-slate-400"> · up to {pf.limitValue}/mo</span>
                          )}
                        </span>
                      </li>
                    ))}
                </ul>
                <div className="mt-6">
                  <ButtonLink
                    href={plan.priceMonthlyCents === 0 ? "/start" : `/app/billing?plan=${plan.id}`}
                    variant={plan.badge ? "primary" : "secondary"}
                    className="w-full"
                  >
                    {plan.priceMonthlyCents === 0 ? "Start free" : `Choose ${plan.name}`}
                  </ButtonLink>
                </div>
              </CardBody>
            </Card>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
