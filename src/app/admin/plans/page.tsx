import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { PlanForm, FeatureMatrix } from "@/components/admin/plan-forms";

export const metadata = { title: "Plans & access control" };

export default async function AdminPlansPage() {
  await guardAdminPage("admin.plans");
  const [plans, features] = await Promise.all([
    db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" }, include: { features: true } }),
    db.featureDef.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
  ]);

  return (
    <div>
      <PageHeader
        title="Plans & access control"
        subtitle="Every feature of the app is gated here by subscription level. Toggle what each plan can access."
      />

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
                {!p.isActive && <Badge color="red">inactive</Badge>}
              </div>
              <PlanForm
                plan={{
                  id: p.id,
                  key: p.key,
                  name: p.name,
                  description: p.description,
                  priceMonthly: p.priceMonthlyCents / 100,
                  priceYearly: p.priceYearlyCents / 100,
                  badge: p.badge,
                  sortOrder: p.sortOrder,
                  isActive: p.isActive,
                }}
              />
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
