import { NextResponse } from "next/server";

/**
 * Lightsail / load-balancer liveness probe.
 *
 * Lightsail instance health checks are HTTP-only (no HTTPS). Point the LB at
 * this path on the instance port (usually 3000, or HTTP :80 via Caddy with
 * /healthz exempt from HTTPS redirect).
 *
 * Intentionally: no DB, no auth, no redirects — process-up only.
 * Deep readiness stays on GET /api/health.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return new NextResponse("ok\n", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
