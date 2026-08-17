import { NextResponse } from "next/server";
import { timingSafeStringEqual } from "@/lib/secrets";

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? request.headers.get("x-cron-secret") ?? "";
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ error: "Cron secret is not configured" }, { status: 503 });
  }
  if (!timingSafeStringEqual(bearerToken(request), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { processScheduledMessages } = await import("@/lib/messaging");
  const { autoCloseInactiveTickets } = await import("@/actions/support");
  const { purgeExpiredDeletedAccounts } = await import("@/lib/deleted-accounts");
  const { purgeOldSystemLogs } = await import("@/lib/syslog");
  const { autoCloseCases } = await import("@/lib/case-closing");
  const { processQueuedReanalysisEvents } = await import("@/lib/reanalysis-events");

  const maintenance = {
    scheduledMessagesSent: await processScheduledMessages(),
    ticketsAutoClosed: await autoCloseInactiveTickets(),
    reanalysisEventsProcessed: await processQueuedReanalysisEvents(),
    casesAutoClosed: await autoCloseCases(),
    accountsExpunged: await purgeExpiredDeletedAccounts(),
    oldLogsPurged: await purgeOldSystemLogs(30),
  };

  return NextResponse.json({ ok: true, maintenance }, { headers: { "Cache-Control": "no-store" } });
}
