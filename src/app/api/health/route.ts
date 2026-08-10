import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, secureCookiesEnabled } from "@/lib/auth";

// Diagnostic endpoint: reports whether the server can reach the database,
// which cookie mode is active, and whether the current request carries a
// valid session. Safe to expose — no secrets are revealed.
export async function GET() {
  let dbOk = false;
  let appUrl = "";
  try {
    const row = await db.setting.findUnique({ where: { key: "app.url" } });
    appUrl = row?.value ?? "(not set)";
    dbOk = true;
  } catch {
    dbOk = false;
  }
  const user = await getCurrentUser().catch(() => null);
  return NextResponse.json({
    ok: true,
    database: dbOk ? "connected" : "unreachable",
    appUrl,
    secureCookies: dbOk ? await secureCookiesEnabled() : null,
    session: user ? { email: user.email, role: user.role } : null,
    buildHasCookieFix: true,
  });
}
