import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { featureLimit } from "./access";
import { isAdmin } from "./auth";
import {
  DEFAULT_CASE_REPORT_EXTRA_CENTS,
  FEATURE_KEYS,
  PAYMENT_KINDS,
  SETTINGS,
} from "./constants";
import { consultantSubscriptionsEnabled, hasActiveConsultantSubscription } from "./payments";
import { getNumberSetting } from "./settings";

export type CaseReportAccess = {
  allowed: boolean;
  forbidden: boolean;
  paywall: boolean;
  metered: boolean;
  alreadyDownloaded: boolean;
  includedLimit: number | null;
  used: number;
  extraPurchased: number;
  remaining: number | null;
  extraFeeCents: number;
  quotaRedirect: string | null;
  billingRedirect: string | null;
};

export function formatUsdCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export async function extraCaseReportFeeCents(): Promise<number> {
  const n = await getNumberSetting(SETTINGS.CASE_REPORT_EXTRA_CENTS, DEFAULT_CASE_REPORT_EXTRA_CENTS);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : DEFAULT_CASE_REPORT_EXTRA_CENTS;
}

async function extraPurchasedCount(userId: string): Promise<number> {
  return db.paymentTransaction.count({
    where: { userId, kind: PAYMENT_KINDS.CASE_REPORT_EXTRA, status: "succeeded" },
  });
}

export async function getCaseReportAccess(
  user: { id: string; role: string },
  caseId: string,
): Promise<CaseReportAccess> {
  const extraFeeCents = await extraCaseReportFeeCents();
  const empty = (overrides: Partial<CaseReportAccess>): CaseReportAccess => ({
    allowed: false,
    forbidden: false,
    paywall: false,
    metered: false,
    alreadyDownloaded: false,
    includedLimit: 0,
    used: 0,
    extraPurchased: 0,
    remaining: 0,
    extraFeeCents,
    quotaRedirect: null,
    billingRedirect: null,
    ...overrides,
  });

  const c = await db.case.findUnique({ where: { id: caseId }, select: { id: true, userId: true } });
  if (!c) return empty({ forbidden: true });

  if (isAdmin(user)) {
    return empty({ allowed: true, remaining: null, includedLimit: null });
  }

  if (user.role === "consultant" && c.userId) {
    const assignment = await db.consultantAssignment.findFirst({
      where: { consultantId: user.id, userId: c.userId, status: "active" },
      select: { id: true },
    });
    if (!assignment) return empty({ forbidden: true });
    if (await consultantSubscriptionsEnabled()) {
      if (!(await hasActiveConsultantSubscription(user.id))) {
        return empty({ billingRedirect: "/consultant/billing?required=1" });
      }
      return meteredAccess(user.id, caseId, `/consultant/clients/${assignment.id}/cases/${caseId}?report_quota=1`, extraFeeCents);
    }
    // Partner subscriptions are off: assigned consultants keep professional copies
    // without consuming the customer's included downloads.
    return empty({ allowed: true, remaining: null, includedLimit: null });
  }

  if (c.userId === user.id) {
    return meteredAccess(user.id, caseId, `/app/cases/${caseId}?report_quota=1`, extraFeeCents);
  }

  return empty({ forbidden: true });
}

async function meteredAccess(
  userId: string,
  caseId: string,
  quotaRedirect: string,
  extraFeeCents: number,
): Promise<CaseReportAccess> {
  const [includedLimit, used, extraPurchased, existing] = await Promise.all([
    featureLimit(userId, FEATURE_KEYS.CASE_REPORT),
    db.caseReportDownload.count({ where: { userId } }),
    extraPurchasedCount(userId),
    db.caseReportDownload.findUnique({ where: { userId_caseId: { userId, caseId } } }),
  ]);
  const alreadyDownloaded = !!existing;
  if (includedLimit === null) {
    return {
      allowed: true,
      forbidden: false,
      paywall: false,
      metered: false,
      alreadyDownloaded,
      includedLimit: null,
      used,
      extraPurchased,
      remaining: null,
      extraFeeCents,
      quotaRedirect: null,
      billingRedirect: null,
    };
  }
  const remaining = Math.max(0, includedLimit + extraPurchased - used);
  const allowed = alreadyDownloaded || remaining > 0;
  return {
    allowed,
    forbidden: false,
    paywall: !allowed,
    metered: true,
    alreadyDownloaded,
    includedLimit,
    used,
    extraPurchased,
    remaining,
    extraFeeCents,
    quotaRedirect,
    billingRedirect: null,
  };
}

export async function consumeCaseReportDownload(
  userId: string,
  caseId: string,
): Promise<"ok" | "payment_required"> {
  const includedLimit = await featureLimit(userId, FEATURE_KEYS.CASE_REPORT);
  if (includedLimit === null) return "ok";

  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.caseReportDownload.findUnique({
        where: { userId_caseId: { userId, caseId } },
      });
      if (existing) return "ok" as const;
      const [used, extraPurchased] = await Promise.all([
        tx.caseReportDownload.count({ where: { userId } }),
        tx.paymentTransaction.count({
          where: { userId, kind: PAYMENT_KINDS.CASE_REPORT_EXTRA, status: "succeeded" },
        }),
      ]);
      if (used >= includedLimit + extraPurchased) return "payment_required" as const;
      await tx.caseReportDownload.create({
        data: {
          userId,
          caseId,
          source: used < includedLimit ? "included" : "extra",
        },
      });
      return "ok" as const;
    });
    return result;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return "ok";
    throw err;
  }
}
