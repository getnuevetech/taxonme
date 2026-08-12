import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { PlanForm, FeatureMatrix, ConsultantSubsToggle, ProrationToggle } from "@/components/admin/plan-forms";
import { PlanDiscountForm } from "@/components/admin/plan-discount-forms";
import { getBoolSetting } from "@/lib/settings";

export const metadata = { title: "Plans & access control" };

export default async function AdminPlansPage() {
  await guardAdminPage("admin.plans");
  const [plans, features, consultantSubsEnabled, prorationEnabled, prorationDowngrade] = await Promise.all([
    db.subscriptionPlan.findMany({
      orderBy: [{ audience: "asc" }, { sortOrder: "asc" }],
      include: { features: true, discounts: { orderBy: { createdAt: "desc" } } },
    }),
    db.featureDef.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    getBoolSetting("consultants.subscriptions_enabled", false),
    getBoolSetting("billing.proration_enabled", true),
    getBoolSetting("billing.proration_downgrade_enabled", false),
  ]);

  return (
    <div>
      <PageHeader
        title="Plans & access control"
        subtitle="Every feature of the app is gated here by subscription level. Toggle what each plan can access."
      />

      <Card className="mb-8">
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Proration</h2>
          <p className="mb-3 text-xs text-slate-500">
            When a subscriber switches plans mid-period, the unused value of their current plan becomes a credit. On the
            manual gateway the customer is charged only the difference; on Stripe the credit converts to free days of the
            new plan before billing starts. Downgrades only receive credit when explicitly allowed below.
          </p>
          <ProrationToggle enabled={prorationEnabled} downgradeEnabled={prorationDowngrade} />
        </CardBody>
      </Card>

      <Card className="mb-8">
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Consultant / CPA subscriptions</h2>
          <p className="mb-3 text-xs text-slate-500">
            When enabled, consultants must hold an active partner plan (audience: CPA / Consultants) to accept new client
            assignments. When disabled, consultants work without a subscription and partner plans are hidden.
          </p>
          <ConsultantSubsToggle enabled={consultantSubsEnabled} />
        </CardBody>
      </Card>

      <Card className="mb-8">
        <CardBody>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Feature access matrix</h2>
          <FeatureMatrix
            plans={plans.map((p) => ({ id: p.id, name: p.name }))}
            features={features.map((f) => ({ key: f.key, name: f.name, category: f.category }))}
            values={plans.flatMap((p) =>
              p.features.map((pf) => ({ planId: p.id, featureKey: pf.featureKey, enabled: pf.enabled, limitValue: pf.limitValue })),
            )}
          />
        </CardBody>
      </Card>

      <h2 className="mb-3 text-base font-semibold text-slate-900">Plans</h2>
      <div className="space-y-6">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardBody>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <Badge>{p.key}</Badge>
                <Badge color={p.audience === "consultant" ? "amber" : "indigo"}>
                  {p.audience === "consultant" ? "CPA / Consultants" : "Customers"}
                </Badge>
                {!p.isActive && <Badge color="red">inactive</Badge>}
              </div>
              <PlanForm
                plan={{
                  id: p.id,
                  key: p.key,
                  name: p.name,
                  audience: p.audience,
                  description: p.description,
                  priceMonthly: p.priceMonthlyCents / 100,
                  priceYearly: p.priceYearlyCents / 100,
                  badge: p.badge,
                  sortOrder: p.sortOrder,
                  isActive: p.isActive,
                }}
              />
              <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                  Discounts ({p.discounts.length})
                  {p.discounts.some((d) => d.isActive) && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      {p.discounts.filter((d) => d.isActive).length} active
                    </span>
                  )}
                </summary>
                <p className="mt-2 text-xs text-slate-500">
                  Customers see active discounts on the pricing and billing pages (struck-through original price + sale badge),
                  and pay the discounted amount at checkout. Target specific people by email, or run a general sale.
                </p>
                <div className="mt-4 space-y-6">
                  {p.discounts.map((d) => {
                    let emails: string[] = [];
                    try { const parsed = JSON.parse(d.emailsJson || "[]"); if (Array.isArray(parsed)) emails = parsed; } catch { /* empty */ }
                    return (
                      <div key={d.id} className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                        <PlanDiscountForm
                          planId={p.id}
                          discount={{
                            id: d.id,
                            planId: d.planId,
                            name: d.name,
                            percentOff: d.percentOff,
                            amountOffCents: d.amountOffCents,
                            audience: d.audience,
                            emails,
                            startsAt: d.startsAt ? d.startsAt.toISOString().slice(0, 10) : null,
                            endsAt: d.endsAt ? d.endsAt.toISOString().slice(0, 10) : null,
                            isActive: d.isActive,
                          }}
                        />
                      </div>
                    );
                  })}
                  <div className="rounded-lg bg-white p-4 ring-1 ring-dashed ring-slate-300">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">New discount</p>
                    <PlanDiscountForm planId={p.id} discount={null} />
                  </div>
                </div>
              </details>
            </CardBody>
          </Card>
        ))}
        <Card>
          <CardBody>
            <h3 className="mb-3 font-semibold text-slate-900">Add a plan</h3>
            <PlanForm plan={null} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
