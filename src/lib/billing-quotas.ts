/**
 * Wave 3a/5 — monthly quotas for IRS form wizards / downloads / Prep Plans.
 * Plus is capped; Pro is unlimited. Free cannot run wizards, download forms, or build Prep Plans.
 */
import "server-only";
import { db } from "@/lib/db";
import { featureLimit, hasFeature } from "@/lib/access";
import { FEATURE_KEYS } from "@/lib/constants";

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export type FeatureQuota = {
  hasAccess: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  overLimit: boolean;
};

function pack(hasAccess: boolean, limit: number | null, used: number): FeatureQuota {
  return {
    hasAccess,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    overLimit: hasAccess && limit !== null && used >= limit,
  };
}

/** Wave 5: Prep Plan builds counted per UTC calendar month via PrepPlan rows. */
export async function getPrepPlanQuota(userId: string): Promise<FeatureQuota> {
  const since = startOfUtcMonth();
  const [hasAccess, limit, used] = await Promise.all([
    hasFeature(userId, FEATURE_KEYS.PREP_PLAN_BUILD),
    featureLimit(userId, FEATURE_KEYS.PREP_PLAN_BUILD),
    db.prepPlan.count({
      where: { situation: { userId }, createdAt: { gte: since } },
    }),
  ]);
  return pack(hasAccess, limit, used);
}

export async function getFormWizardQuota(userId: string): Promise<FeatureQuota> {
  const since = startOfUtcMonth();
  const [hasAccess, limit, used] = await Promise.all([
    hasFeature(userId, FEATURE_KEYS.FORMS),
    featureLimit(userId, FEATURE_KEYS.FORMS),
    db.formSubmission.count({
      where: { userId, createdAt: { gte: since } },
    }),
  ]);
  return pack(hasAccess, limit, used);
}

export async function getFormDownloadQuota(userId: string): Promise<FeatureQuota> {
  // Soft meter: completed submissions updated this UTC month.
  const since = startOfUtcMonth();
  const [hasAccess, limit, used] = await Promise.all([
    hasFeature(userId, FEATURE_KEYS.FORMS_DOWNLOAD),
    featureLimit(userId, FEATURE_KEYS.FORMS_DOWNLOAD),
    db.formSubmission.count({
      where: { userId, status: "completed", updatedAt: { gte: since } },
    }),
  ]);
  return pack(hasAccess, limit, used);
}
