"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ActionState } from "./auth";

// Subscription checkout. Gateway behavior is driven entirely by the
// admin-configured PaymentGatewayConfig rows — nothing vendor-specific is hardcoded.
export async function subscribeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const planId = String(formData.get("planId") ?? "");
  const interval = String(formData.get("interval") ?? "monthly");
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) return { error: "Plan not available." };

  // Plans are audience-specific: customers can't buy consultant plans and vice versa.
  const expectedAudience = user.role === "consultant" ? "consultant" : "customer";
  if (plan.audience !== expectedAudience) return { error: "This plan is not available for your account type." };

  // Settle any in-flight checkout first, so the duplicate check sees the truth.
  const { reconcilePendingStripeTransactions } = await import("@/lib/payments");
  await reconcilePendingStripeTransactions(user.id);

  // No duplicate subscriptions: the same active plan can't be purchased again.
  // Switching to a different plan (upgrade/downgrade) is allowed.
  const currentSub = await db.subscription.findFirst({
    where: {
      userId: user.id,
      status: { in: ["active", "trialing"] },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
  if (currentSub?.planId === plan.id) {
    return { error: `You're already subscribed to the ${plan.name} plan. Pick a different plan to upgrade or downgrade.` };
  }
  const inFlight = await db.paymentTransaction.findFirst({
    where: {
      userId: user.id,
      planId: plan.id,
      status: "pending",
      createdAt: { gte: new Date(Date.now() - 30 * 60000) },
    },
  });
  if (inFlight) {
    return { error: "Your previous payment for this plan is still processing. Give it a minute, then refresh this page — if it doesn't confirm, the checkout expires automatically and you can try again." };
  }

  const gateway = await db.paymentGatewayConfig.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }],
  });
  const amountCents = interval === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;
  const billingPath = user.role === "consultant" ? "/consultant/billing" : "/app/billing";

  // Proration: switching plans mid-period credits the unused value of the
  // current plan (admin-controlled, incl. whether downgrades qualify).
  const { computeProration, activateSubscription } = await import("@/lib/payments");
  const proration = await computeProration(
    user.id,
    { id: plan.id, priceMonthlyCents: plan.priceMonthlyCents, priceYearlyCents: plan.priceYearlyCents },
    interval === "yearly" ? "yearly" : "monthly",
  );

  if (!gateway || gateway.kind === "manual" || amountCents === 0) {
    // Manual/dev gateway or free plan: activate immediately, charging only the
    // prorated difference when a credit applies.
    const charge = amountCents === 0 ? 0 : proration.applied ? proration.chargeCents : amountCents;
    await activateSubscription({
      userId: user.id,
      planId: plan.id,
      interval: interval === "yearly" ? "yearly" : "monthly",
      gateway: gateway?.kind ?? "manual",
      gatewayRef: "",
    });
    if (charge > 0) {
      await db.paymentTransaction.create({
        data: {
          userId: user.id,
          planId: plan.id,
          amountCents: charge,
          gateway: gateway?.kind ?? "manual",
          status: "succeeded",
        },
      });
    }
    redirect(`${billingPath}?subscribed=1${proration.applied ? `&prorated=${proration.creditCents}` : ""}`);
  }

  if (gateway.kind === "stripe") {
    const cfg = JSON.parse(gateway.configJson || "{}");
    if (!cfg.secretKey) return { error: "Payment gateway is not fully configured. Contact support." };

    // Supersede any other in-flight checkouts: expire them at Stripe and mark
    // the local transactions abandoned, so they can't linger as "pending".
    const stale = await db.paymentTransaction.findMany({
      where: { userId: user.id, gateway: "stripe", status: "pending", gatewayRef: { not: "" } },
    });
    for (const tx of stale) {
      await fetch(`https://api.stripe.com/v1/checkout/sessions/${tx.gatewayRef}/expire`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.secretKey}` },
      }).catch(() => null);
      await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: "abandoned" } });
    }

    // Create our transaction FIRST so its reference travels to Stripe — every
    // Stripe object (session, subscription) carries our TXN number for tracing.
    const tx = await db.paymentTransaction.create({
      data: { userId: user.id, planId: plan.id, amountCents, gateway: "stripe", status: "pending" },
    });
    const { formatTransactionNumber } = await import("@/lib/ticket-number");
    const txnRef = formatTransactionNumber(tx.number);

    const params = new URLSearchParams({
      mode: "subscription",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": cfg.currency || "usd",
      "line_items[0][price_data][unit_amount]": String(amountCents),
      "line_items[0][price_data][recurring][interval]": interval === "yearly" ? "year" : "month",
      "line_items[0][price_data][product_data][name]": plan.name,
      success_url: `${cfg.appUrl || ""}${billingPath}?pending=1`,
      cancel_url: `${cfg.appUrl || ""}${billingPath}?canceled=1`,
      client_reference_id: user.id,
      customer_email: user.email,
      // The webhook uses this metadata to activate the right plan after payment;
      // the transaction reference makes the payment traceable end to end.
      "metadata[planId]": plan.id,
      "metadata[interval]": interval,
      "metadata[transactionRef]": txnRef,
      "metadata[transactionId]": tx.id,
      "subscription_data[metadata][planId]": plan.id,
      "subscription_data[metadata][interval]": interval,
      "subscription_data[metadata][transactionRef]": txnRef,
    });
    // Stripe proration: the unused value of the old plan becomes free days of
    // the new plan (billing starts after the credit period).
    if (proration.applied && proration.creditDays >= 1) {
      params.set("subscription_data[trial_period_days]", String(proration.creditDays));
    }
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) {
      await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: "failed" } });
      return { error: "Could not start checkout. Please try again or contact support." };
    }
    const session = await res.json();
    await db.paymentTransaction.update({ where: { id: tx.id }, data: { gatewayRef: session.id ?? "" } });
    redirect(session.url);
  }

  return { error: "No payment method is available right now. Please contact support." };
}

export async function cancelSubscriptionAction() {
  const user = await requireUser();
  await db.subscription.updateMany({
    where: { userId: user.id, status: { in: ["active", "trialing"] } },
    data: { status: "canceled", canceledAt: new Date() },
  });
  const { sendSystemMessage } = await import("@/lib/messaging");
  await sendSystemMessage("subscription_canceled", user, {
    link: user.role === "consultant" ? "/consultant/billing" : "/app/billing",
  });
  redirect(user.role === "consultant" ? "/consultant/billing?canceled=1" : "/app/billing?canceled=1");
}
