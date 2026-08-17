import "server-only";
import { db } from "./db";
import { logSystem } from "./syslog";
import { runCaseAnalysis } from "./ai/orchestrator";

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
      await runCaseAnalysis(event.caseId, { trigger: event.trigger, reanalysisEventId: event.id });
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
