import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, secureCookiesEnabled } from "@/lib/auth";
import { timingSafeStringEqual } from "@/lib/secrets";

/**
 * Deep readiness probe for host ops (not for Lightsail LB — use GET /healthz over HTTP).
 * GET /api/health — does not require auth for liveness fields.
 * Maintenance jobs run only when Authorization: Bearer <CRON_SECRET>
 * (or ?secret=) matches process.env.CRON_SECRET or setting cron.secret.
 *
 * Schema readiness reports core tables including Situation and ExperienceObservation.
 *
 * Dedicated POST /api/cron/maintenance remains supported for existing cron jobs.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveCronSecret(): Promise<string> {
  if (process.env.CRON_SECRET?.trim()) return process.env.CRON_SECRET.trim();
  const row = await db.setting.findUnique({ where: { key: "cron.secret" } }).catch(() => null);
  return (row?.value ?? "").trim();
}

function authorizedCron(request: Request, secret: string): boolean {
  if (!secret) return false;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const urlSecret = new URL(request.url).searchParams.get("secret") || "";
  return timingSafeStringEqual(bearer || urlSecret, secret);
}

type Probe = "ok" | "missing" | "error";

async function schemaChecks(): Promise<{
  case_table: Probe;
  guest_session: Probe;
  evidence_fact: Probe;
  situation_table: Probe;
  experience_observation: Probe;
}> {
  const checks: {
    case_table: Probe;
    guest_session: Probe;
    evidence_fact: Probe;
    situation_table: Probe;
    experience_observation: Probe;
  } = {
    case_table: "error",
    guest_session: "error",
    evidence_fact: "error",
    situation_table: "error",
    experience_observation: "missing",
  };

  try {
    await db.case.findFirst({ select: { id: true } });
    checks.case_table = "ok";
  } catch {
    checks.case_table = "missing";
  }

  try {
    await db.guestSession.findFirst({ select: { id: true } });
    checks.guest_session = "ok";
  } catch {
    checks.guest_session = "missing";
  }

  try {
    await db.evidenceFact.findFirst({ select: { id: true } });
    checks.evidence_fact = "ok";
  } catch {
    checks.evidence_fact = "missing";
  }

  try {
    await db.situation.findFirst({ select: { id: true } });
    checks.situation_table = "ok";
  } catch {
    checks.situation_table = "missing";
  }
  try {
    await db.experienceObservation.findFirst({ select: { id: true } });
    checks.experience_observation = "ok";
  } catch {
    checks.experience_observation = "missing";
  }

  return checks;
}

function coreSchemaReady(schema: Awaited<ReturnType<typeof schemaChecks>>): boolean {
  return (
    schema.case_table === "ok" &&
    schema.guest_session === "ok" &&
    schema.evidence_fact === "ok" &&
    schema.situation_table === "ok" &&
    schema.experience_observation === "ok"
  );
}

export async function GET(request: Request) {
  let dbOk = false;
  let appUrl = "";
  try {
    const row = await db.setting.findUnique({ where: { key: "app.url" } });
    appUrl = row?.value ? "(configured)" : "(not set)";
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const cronSecret = dbOk ? await resolveCronSecret() : "";
  const runMaintenance = dbOk && authorizedCron(request, cronSecret);

  let maintenance: Record<string, number> | null = null;
  if (runMaintenance) {
    try {
      const { processScheduledMessages } = await import("@/lib/messaging");
      const { autoCloseInactiveTickets } = await import("@/actions/support");
      const { purgeExpiredDeletedAccounts } = await import("@/lib/deleted-accounts");
      const { purgeOldSystemLogs } = await import("@/lib/syslog");
      const { autoCloseCases } = await import("@/lib/case-closing");
      const { failStaleReanalysisEvents, processQueuedReanalysisEvents } = await import("@/lib/reanalysis-events");
      const { syncAgencyUpdates } = await import("@/lib/agency-updates/sync");
      const irsSync = await syncAgencyUpdates();
      maintenance = {
        scheduledMessagesSent: await processScheduledMessages(),
        ticketsAutoClosed: await autoCloseInactiveTickets(),
        staleReanalysisEventsFailed: await failStaleReanalysisEvents(),
        reanalysisEventsProcessed: await processQueuedReanalysisEvents(),
        casesAutoClosed: await autoCloseCases(),
        accountsExpunged: await purgeExpiredDeletedAccounts(),
        oldLogsPurged: await purgeOldSystemLogs(30),
        irsUpdatesFetched: irsSync.fetched ?? 0,
        irsUpdatesUpserted: irsSync.upserted ?? 0,
      };
    } catch {
      maintenance = { error: 1 };
    }
  }

  const user = await getCurrentUser().catch(() => null);
  const schema = dbOk
    ? await schemaChecks()
    : {
        case_table: "error" as const,
        guest_session: "error" as const,
        evidence_fact: "error" as const,
        situation_table: "error" as const,
        experience_observation: "error" as const,
      };
  const schemaReady = dbOk && coreSchemaReady(schema);

  return NextResponse.json(
    {
      ok: dbOk,
      database: dbOk ? "connected" : "unreachable",
      appUrlConfigured: appUrl === "(configured)",
      secureCookies: dbOk ? await secureCookiesEnabled() : null,
      signedIn: Boolean(user),
      maintenance,
      schema,
      schemaReady,
      hint: schemaReady
        ? null
        : "Schema not ready — run `npx prisma migrate deploy` (or rebuild Docker so the entrypoint migrates), then restart.",
    },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
