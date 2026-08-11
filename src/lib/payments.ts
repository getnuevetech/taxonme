import "server-only";
import { db } from "./db";
import { getBoolSetting } from "./settings";

// Shared subscription activation used by the Stripe webhook AND the
// reconciliation path (which queries Stripe directly, so payments confirm
// even before webhooks are configured).

export async function activateSubscription(opts: {
  userId: string;
  planId: string;
  interval: "monthly" | "yearly";
  gateway: string;
  gatewayRef: string;
  extraDays?: number; // proration credit converted to time
}) {
  await db.subscription.updateMany({
    where: { userId: opts.userId, status: { in: ["active", "trialing"] } },
    data: { status: "canceled", canceledAt: new Date() },
  });
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + (opts.interval === "yearly" ? 12 : 1));
  if (opts.extraDays && opts.extraDays > 0) periodEnd.setDate(periodEnd.getDate() + opts.extraDays);
  await db.subscription.create({
    data: {
      userId: opts.userId,
      planId: opts.planId,
      interval: opts.interval,
      gateway: opts.gateway,
      gatewayRef: opts.gatewayRef,
      currentPeriodEnd: periodEnd,
    },
  });
  const [user, plan] = await Promise.all([
    db.user.findUnique({ where: { id: opts.userId } }),
    db.subscriptionPlan.findUnique({ where: { id: opts.planId } }),
  ]);
  if (user && plan) {
    const { sendSystemMessage } = await import("./messaging");
    const sent = await sendSystemMessage("subscription_confirmed", user, {
      planName: plan.name,
      expiresOn: periodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      link: plan.audience === "consultant" ? "/consultant/billing" : "/app/billing",
    });
    if (!sent) {
      await db.notification.create({
        data: {
          userId: opts.userId,
          kind: "billing",
          title: "Payment confirmed — your plan is active",
          body: "Thanks! Your subscription features are unlocked.",
          link: "/app/billing",
        },
      });
    }
  }
}

// ---------- Proration ----------
// When a subscriber switches plans mid-period, the unused value of the current
// plan becomes a credit. Admin controls (Plans page): enable/disable the whole
// system, and separately allow it for downgrades.

export type Proration = {
  applied: boolean;
  direction: "upgrade" | "downgrade" | "none";
  creditCents: number; // unused value of the current plan
  chargeCents: number; // what to charge now (manual gateway)
  creditDays: number; // credit converted to free days of the new plan (Stripe)
};

export async function computeProration(
  userId: string,
  newPlan: { id: string; priceMonthlyCents: number; priceYearlyCents: number },
  interval: "monthly" | "yearly",
): Promise<Proration> {
  const none: Proration = { applied: false, direction: "none", creditCents: 0, chargeCents: 0, creditDays: 0 };
  const newPrice = interval === "yearly" ? newPlan.priceYearlyCents : newPlan.priceMonthlyCents;

  const enabled = await getBoolSetting("billing.proration_enabled", true);
  if (!enabled) return { ...none, chargeCents: newPrice };

  const current = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trialing"] },
      currentPeriodEnd: { gte: new Date() },
      planId: { not: newPlan.id },
    },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
  if (!current?.currentPeriodEnd) return { ...none, chargeCents: newPrice };

  const currentPrice = current.interval === "yearly" ? current.plan.priceYearlyCents : current.plan.priceMonthlyCents;
  if (currentPrice <= 0) return { ...none, chargeCents: newPrice };

  // Unused fraction of the current period.
  const periodDays = current.interval === "yearly" ? 365 : 30;
  const remainingDays = Math.max(0, (current.currentPeriodEnd.getTime() - Date.now()) / (24 * 3600000));
  const creditCents = Math.round(currentPrice * Math.min(1, remainingDays / periodDays));

  const newMonthlyEq = newPlan.priceMonthlyCents || Math.round(newPlan.priceYearlyCents / 12);
  const curMonthlyEq = current.plan.priceMonthlyCents || Math.round(current.plan.priceYearlyCents / 12);
  const direction: Proration["direction"] = newMonthlyEq >= curMonthlyEq ? "upgrade" : "downgrade";

  if (direction === "downgrade" && !(await getBoolSetting("billing.proration_downgrade_enabled", false))) {
    return { applied: false, direction, creditCents: 0, chargeCents: newPrice, creditDays: 0 };
  }

  const chargeCents = Math.max(0, newPrice - creditCents);
  const newDaily = newPrice / (interval === "yearly" ? 365 : 30);
  const creditDays = newDaily > 0 ? Math.min(365, Math.floor(creditCents / newDaily)) : 0;
  return { applied: creditCents > 0, direction, creditCents, chargeCents, creditDays };
}

/**
 * Reconcile a user's pending Stripe transactions by asking Stripe directly.
 * Called on billing-page load, so subscriptions activate promptly even when
 * no webhook endpoint is configured (e.g. local deployments). Pending
 * checkouts older than 24h that were never paid are marked failed.
 */
export async function reconcilePendingStripeTransactions(userId: string): Promise<boolean> {
  const pending = await db.paymentTransaction.findMany({
    where: { userId, gateway: "stripe", status: "pending", gatewayRef: { not: "" } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (pending.length === 0) return false;

  const gateway = await db.paymentGatewayConfig.findFirst({
    where: { kind: "stripe", isActive: true },
    orderBy: [{ isDefault: "desc" }],
  });
  const cfg = gateway ? JSON.parse(gateway.configJson || "{}") : {};
  if (!cfg.secretKey) return false;

  let activated = false;
  for (const tx of pending) {
    try {
      const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${tx.gatewayRef}`, {
        headers: { Authorization: `Bearer ${cfg.secretKey}` },
      });
      if (!res.ok) continue;
      const session = await res.json();
      if (session.payment_status === "paid" || (session.status === "complete" && session.payment_status === "no_payment_required")) {
        await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: "succeeded" } });
        if (tx.planId) {
          const interval = session.metadata?.interval === "yearly" ? "yearly" : "monthly";
          await activateSubscription({
            userId,
            planId: tx.planId,
            interval,
            gateway: "stripe",
            gatewayRef: String(session.subscription ?? session.id),
          });
          activated = true;
        }
      } else if (["expired", "canceled"].includes(String(session.status)) || tx.createdAt < new Date(Date.now() - 24 * 3600000)) {
        // Abandoned checkout: don't let it linger as pending forever.
        await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: "failed" } });
      }
    } catch {
      // network hiccup — try again on next page load
    }
  }
  return activated;
}

// ---------- Consultant subscriptions ----------

export async function consultantSubscriptionsEnabled(): Promise<boolean> {
  return getBoolSetting("consultants.subscriptions_enabled", false);
}

export async function hasActiveConsultantSubscription(userId: string): Promise<boolean> {
  const sub = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trialing"] },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date() } }],
      plan: { audience: "consultant" },
    },
  });
  return !!sub;
}
