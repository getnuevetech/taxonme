import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

// Stripe webhook: subscriptions activate only after Stripe confirms payment.
// Configure the endpoint in the Stripe dashboard as <app.url>/api/webhooks/stripe
// and put the signing secret in the gateway config as "webhookSecret".

function verifySignature(payload: string, header: string, secret: string): boolean {
  const parts = new Map(header.split(",").map((p) => p.split("=") as [string, string]));
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return false;
  // Reject events older than 5 minutes (replay protection).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const payload = await request.text();
  const gateway = await db.paymentGatewayConfig.findFirst({
    where: { kind: "stripe", isActive: true },
    orderBy: [{ isDefault: "desc" }],
  });
  if (!gateway) return NextResponse.json({ error: "No active Stripe gateway" }, { status: 400 });

  const cfg = JSON.parse(gateway.configJson || "{}");
  if (!cfg.webhookSecret) {
    return NextResponse.json({ error: "webhookSecret not configured" }, { status: 400 });
  }
  const signatureHeader = request.headers.get("stripe-signature") ?? "";
  if (!verifySignature(payload, signatureHeader, cfg.webhookSecret)) {
    const { logSystem } = await import("@/lib/syslog");
    await logSystem("warning", "webhook", "Stripe webhook rejected: invalid signature", { header: signatureHeader.slice(0, 100) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId: string | undefined = session.client_reference_id;
    const planId: string | undefined = session.metadata?.planId;
    const interval: string = session.metadata?.interval === "yearly" ? "yearly" : "monthly";

    if (userId && planId) {
      // Mark the pending transaction as paid.
      await db.paymentTransaction.updateMany({
        where: { gateway: "stripe", gatewayRef: session.id },
        data: { status: "succeeded" },
      });
      const { activateSubscription } = await import("@/lib/payments");
      await activateSubscription({
        userId,
        planId,
        interval: interval === "yearly" ? "yearly" : "monthly",
        gateway: "stripe",
        gatewayRef: String(session.subscription ?? session.id),
      });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object;
    const subRef = String(invoice.subscription ?? "");
    if (subRef) {
      await db.subscription.updateMany({
        where: { gateway: "stripe", gatewayRef: subRef, status: "active" },
        data: { status: "past_due" },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    await db.subscription.updateMany({
      where: { gateway: "stripe", gatewayRef: String(sub.id), status: { in: ["active", "past_due", "trialing"] } },
      data: { status: "canceled", canceledAt: new Date() },
    });
  }

  return NextResponse.json({ received: true });
}
