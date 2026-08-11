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
}) {
  await db.subscription.updateMany({
    where: { userId: opts.userId, status: { in: ["active", "trialing"] } },
    data: { status: "canceled", canceledAt: new Date() },
  });
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + (opts.interval === "yearly" ? 12 : 1));
  await db.subscription.create({
    data: {
      userId: opts.userId,
      planId: opts.planId,
      gateway: opts.gateway,
      gatewayRef: opts.gatewayRef,
      currentPeriodEnd: periodEnd,
    },
  });
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
      if (session.payment_status === "paid") {
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
