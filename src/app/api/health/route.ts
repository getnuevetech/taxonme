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
  // Opportunistic maintenance (all dedupe-protected): pinging this endpoint
  // from a daily cron keeps scheduled messages and ticket auto-close running.
  let maintenance: Record<string, number> = {};
  if (dbOk) {
    try {
      const { processScheduledMessages } = await import("@/lib/messaging");
      const { autoCloseInactiveTickets } = await import("@/actions/support");
      const { purgeExpiredDeletedAccounts } = await import("@/lib/deleted-accounts");
      maintenance = {
        scheduledMessagesSent: await processScheduledMessages(),
        ticketsAutoClosed: await autoCloseInactiveTickets(),
        accountsExpunged: await purgeExpiredDeletedAccounts(),
      };
    } catch {
      // maintenance is best-effort
    }
  }

  const user = await getCurrentUser().catch(() => null);
  return NextResponse.json({
    maintenance,
    ok: true,
    database: dbOk ? "connected" : "unreachable",
    appUrl,
    secureCookies: dbOk ? await secureCookiesEnabled() : null,
    session: user ? { email: user.email, role: user.role } : null,
    buildHasCookieFix: true,
  });
}
