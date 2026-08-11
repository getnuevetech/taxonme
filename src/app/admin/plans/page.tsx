import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { PlanForm, FeatureMatrix, ConsultantSubsToggle } from "@/components/admin/plan-forms";
import { getBoolSetting } from "@/lib/settings";

export const metadata = { title: "Plans & access control" };

export default async function AdminPlansPage() {
  await guardAdminPage("admin.plans");
  const [plans, features, consultantSubsEnabled] = await Promise.all([
    db.subscriptionPlan.findMany({ orderBy: [{ audience: "asc" }, { sortOrder: "asc" }], include: { features: true } }),
    db.featureDef.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    getBoolSetting("consultants.subscriptions_enabled", false),
  ]);

  return (
    <div>
      <PageHeader
        title="Plans & access control"
        subtitle="Every feature of the app is gated here by subscription level. Toggle what each plan can access."
      />

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
