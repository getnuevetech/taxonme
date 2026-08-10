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

  const gateway = await db.paymentGatewayConfig.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }],
  });
  const amountCents = interval === "yearly" ? plan.priceYearlyCents : plan.priceMonthlyCents;

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
    redirect("/app/billing?subscribed=1");
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
      success_url: `${cfg.appUrl || ""}/app/billing?pending=1`,
      cancel_url: `${cfg.appUrl || ""}/app/billing?canceled=1`,
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
  redirect("/app/billing?canceled=1");
}
