import "server-only";
import { db } from "./db";

// Central failure/event log surfaced in Admin → System logs.
// Fire-and-forget: logging must never break the flow that calls it.
export async function logSystem(
  level: "error" | "warning" | "info",
  source: string,
  message: string,
  detail?: unknown,
  userId?: string,
): Promise<void> {
  try {
    await db.systemLog.create({
      data: {
        level,
        source,
        message: message.slice(0, 300),
        detail: detail === undefined ? "" : (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 5000),
        userId: userId ?? "",
      },
    });
  } catch {
    // Last resort: at least leave a trace in the server console.
    console.error(`[syslog:${level}:${source}]`, message);
  }
}

export async function purgeOldSystemLogs(days = 30): Promise<number> {
  const res = await db.systemLog.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - days * 24 * 3600000) } },
  });
  return res.count;
}
