import "server-only";
import { db } from "./db";
import { logSystem } from "./syslog";
import { runCaseAnalysis } from "./ai/orchestrator";

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
