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
  if (!gateway || gateway.kind === "manual" || amountCents === 0) {
    // Manual/dev gateway or free plan: activate immediately.
    await db.subscription.updateMany({
      where: { userId: user.id, status: { in: ["active", "trialing"] } },
      data: { status: "canceled", canceledAt: new Date() },
    });
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (interval === "yearly" ? 12 : 1));
    await db.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        gateway: gateway?.kind ?? "manual",
        currentPeriodEnd: periodEnd,
      },
    });
    if (amountCents > 0) {
      await db.paymentTransaction.create({
        data: {
          userId: user.id,
          planId: plan.id,
          amountCents,
          gateway: gateway?.kind ?? "manual",
          status: "succeeded",
        },
      });
    }
    redirect(`${billingPath}?subscribed=1`);
  }

  if (gateway.kind === "stripe") {
    const cfg = JSON.parse(gateway.configJson || "{}");
    if (!cfg.secretKey) return { error: "Payment gateway is not fully configured. Contact support." };
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
      // The webhook uses this metadata to activate the right plan after payment.
      "metadata[planId]": plan.id,
      "metadata[interval]": interval,
      "subscription_data[metadata][planId]": plan.id,
      "subscription_data[metadata][interval]": interval,
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!res.ok) return { error: "Could not start checkout. Please try again or contact support." };
    const session = await res.json();
    await db.paymentTransaction.create({
      data: {
        userId: user.id,
        planId: plan.id,
        amountCents,
        gateway: "stripe",
        gatewayRef: session.id ?? "",
        status: "pending",
      },
    });
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
  redirect(user.role === "consultant" ? "/consultant/billing?canceled=1" : "/app/billing?canceled=1");
}
