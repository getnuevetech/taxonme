import "server-only";
import { db } from "./db";
import { logSystem } from "./syslog";
import { runCaseAnalysis } from "./ai/orchestrator";
import { buildReanalysisIdempotencyKey, pipelinesForMaterialEvent } from "./reanalysis-policy";

type Json = Record<string, unknown>;

export async function queueCaseReanalysis(args: {
  caseId: string;
  trigger: string;
  pipelines?: unknown;
  actorType?: string;
  metadata?: Json;
  materialKey?: string;
}): Promise<string> {
  const pipelines = pipelinesForMaterialEvent(args.trigger, args.pipelines);
  const idempotencyKey = buildReanalysisIdempotencyKey({
    caseId: args.caseId,
    trigger: args.trigger,
    pipelines,
    materialKey: args.materialKey,
  });
  const existing = await db.caseReanalysisEvent.findFirst({
    where: { idempotencyKey, status: { in: ["queued", "running"] } },
    select: { id: true },
  });
  if (existing) return existing.id;
  try {
    const event = await db.caseReanalysisEvent.create({
      data: {
        caseId: args.caseId,
        trigger: args.trigger,
        pipelinesJson: JSON.stringify(pipelines),
        idempotencyKey,
        status: "queued",
        actorType: args.actorType ?? "system",
        metadataJson: JSON.stringify(args.metadata ?? {}),
      },
    });
    await db.case.update({ where: { id: args.caseId }, data: { status: "analyzing" } }).catch(() => null);
    return event.id;
  } catch {
    const race = await db.caseReanalysisEvent.findFirst({
      where: { idempotencyKey, status: { in: ["queued", "running"] } },
      select: { id: true },
    });
    if (race) return race.id;
    throw new Error("Could not queue re-analysis event.");
  }
}

export async function failStaleReanalysisEvents(maxRunningMinutes = 60): Promise<number> {
  const cutoff = new Date(Date.now() - maxRunningMinutes * 60_000);
  const stale = await db.caseReanalysisEvent.updateMany({
    where: { status: "running", createdAt: { lt: cutoff } },
    data: {
      status: "failed",
      finishedAt: new Date(),
      metadataJson: JSON.stringify({ error: `Marked failed after running for more than ${maxRunningMinutes} minutes.` }),
    },
  });
  if (stale.count > 0) {
    await logSystem("warning", "analysis", "Marked stale v3 re-analysis events as failed", `${stale.count} event(s) exceeded ${maxRunningMinutes} minutes.`);
  }
  return stale.count;
}

export async function processQueuedReanalysisEvents(limit = 10): Promise<number> {
  const events = await db.caseReanalysisEvent.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let processed = 0;
  for (const event of events) {
    const claimed = await db.caseReanalysisEvent.updateMany({
      where: { id: event.id, status: "queued" },
      data: { status: "running" },
    });
    if (claimed.count === 0) continue;
    try {
      let pipelines: unknown = [];
      try {
        pipelines = JSON.parse(event.pipelinesJson || "[]");
      } catch {
        pipelines = [];
      }
      await runCaseAnalysis(event.caseId, {
        trigger: event.trigger,
        reanalysisEventId: event.id,
        pipelines: pipelinesForMaterialEvent(event.trigger, pipelines),
      });
      await db.caseReanalysisEvent.update({
        where: { id: event.id },
        data: { status: "complete", finishedAt: new Date() },
      });
      processed++;
    } catch (err) {
      await db.caseReanalysisEvent.update({
        where: { id: event.id },
        data: { status: "failed", finishedAt: new Date(), metadataJson: JSON.stringify({ error: String(err).slice(0, 1000) }) },
      }).catch(() => null);
      await logSystem("error", "analysis", "Queued v3 re-analysis failed", String(err));
    }
  }
  return processed;
}
