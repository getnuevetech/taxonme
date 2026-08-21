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
    const expectedBuf = Buffer.from(expected, "hex");
    const signatureBuf = Buffer.from(signature, "hex");
    // timingSafeEqual throws if the buffers differ in length — guard explicitly.
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
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

  let event: {
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object ?? {};
    const metadata = (session.metadata && typeof session.metadata === "object" ? session.metadata : {}) as Record<string, unknown>;
    const userId = String(session.client_reference_id ?? "");
    const planId = String(metadata.planId ?? "");
    const transactionId = String(metadata.transactionId ?? "");
    const interval = metadata.interval === "yearly" ? "yearly" : "monthly";
    const sessionId = String(session.id ?? "");
    const paid =
      session.payment_status === "paid" ||
      (session.status === "complete" && session.payment_status === "no_payment_required");
    const { PAYMENT_KINDS } = await import("@/lib/constants");
    const kind = String(metadata.kind ?? PAYMENT_KINDS.SUBSCRIPTION);

    if (kind === PAYMENT_KINDS.CASE_REPORT_EXTRA && userId && transactionId && sessionId && paid) {
      const tx = await db.paymentTransaction.findFirst({
        where: { id: transactionId, userId, kind: PAYMENT_KINDS.CASE_REPORT_EXTRA, gateway: "stripe" },
      });
      if (!tx) {
        const { logSystem } = await import("@/lib/syslog");
        await logSystem("warning", "webhook", "Stripe extra-report checkout rejected: no matching transaction", { sessionId, transactionId, userId });
        return NextResponse.json({ received: true });
      }
      if (tx.status === "succeeded") return NextResponse.json({ received: true });
      if (tx.status !== "pending") {
        const { logSystem } = await import("@/lib/syslog");
        await logSystem("warning", "webhook", "Stripe extra-report checkout rejected: transaction is not pending", { sessionId, transactionId, status: tx.status });
        return NextResponse.json({ received: true });
      }
      const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
      if (amountTotal !== null && amountTotal > 0 && amountTotal !== tx.amountCents) {
        const { logSystem } = await import("@/lib/syslog");
        await logSystem("warning", "webhook", "Stripe extra-report checkout rejected: amount mismatch", { sessionId, transactionId, expected: tx.amountCents, actual: amountTotal });
        return NextResponse.json({ received: true });
      }
      await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: "succeeded" } });
      return NextResponse.json({ received: true });
    }

    if (userId && planId && transactionId && sessionId && paid) {
      const tx = await db.paymentTransaction.findFirst({
        where: { id: transactionId, userId, planId, gateway: "stripe", gatewayRef: sessionId },
      });
      if (!tx) {
        const { logSystem } = await import("@/lib/syslog");
        await logSystem("warning", "webhook", "Stripe checkout rejected: no matching pending transaction", { sessionId, transactionId, userId, planId });
        return NextResponse.json({ received: true });
      }
      if (tx.status === "succeeded") return NextResponse.json({ received: true });
      if (tx.status !== "pending") {
        const { logSystem } = await import("@/lib/syslog");
        await logSystem("warning", "webhook", "Stripe checkout rejected: transaction is not pending", { sessionId, transactionId, status: tx.status });
        return NextResponse.json({ received: true });
      }
      const amountTotal = typeof session.amount_total === "number" ? session.amount_total : null;
      if (amountTotal !== null && amountTotal > 0 && amountTotal !== tx.amountCents) {
        const { logSystem } = await import("@/lib/syslog");
        await logSystem("warning", "webhook", "Stripe checkout rejected: amount mismatch", { sessionId, transactionId, expected: tx.amountCents, actual: amountTotal });
        return NextResponse.json({ received: true });
      }
      await db.paymentTransaction.update({ where: { id: tx.id }, data: { status: "succeeded" } });
      const { activateSubscription } = await import("@/lib/payments");
      await activateSubscription({
        userId,
        planId: tx.planId ?? planId,
        interval,
        gateway: "stripe",
        gatewayRef: String(session.subscription ?? session.id),
      });
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data?.object ?? {};
    const subRef = String(invoice.subscription ?? "");
    if (subRef) {
      await db.subscription.updateMany({
        where: { gateway: "stripe", gatewayRef: subRef, status: "active" },
        data: { status: "past_due" },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data?.object ?? {};
    const subId = String(sub.id ?? "");
    if (!subId) return NextResponse.json({ received: true });
    await db.subscription.updateMany({
      where: { gateway: "stripe", gatewayRef: subId, status: { in: ["active", "past_due", "trialing"] } },
      data: { status: "canceled", canceledAt: new Date() },
    });
  }

  return NextResponse.json({ received: true });
}
