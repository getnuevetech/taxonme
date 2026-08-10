import "server-only";
import { db } from "./db";
import { getSetting } from "./settings";

// Plan-based feature access. The plan/feature matrix is fully controlled by admins.

export async function getActivePlan(userId: string) {
  const sub = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trialing"] },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    include: { plan: { include: { features: true } } },
  });
  if (sub) return sub.plan;
  // Users without a paid subscription fall back to the admin-designated free plan.
  const freePlanKey = await getSetting("billing.free_plan_key", "free");
  return db.subscriptionPlan.findUnique({
    where: { key: freePlanKey },
    include: { features: true },
  });
}

export async function hasFeature(userId: string, featureKey: string): Promise<boolean> {
  const plan = await getActivePlan(userId);
  if (!plan) return false;
  const f = plan.features.find((pf) => pf.featureKey === featureKey);
  return !!f?.enabled;
}

export async function featureLimit(userId: string, featureKey: string): Promise<number | null> {
  const plan = await getActivePlan(userId);
  const f = plan?.features.find((pf) => pf.featureKey === featureKey);
  if (!f?.enabled) return 0;
  return f.limitValue; // null = unlimited
}
