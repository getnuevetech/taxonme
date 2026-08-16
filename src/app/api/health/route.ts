import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public liveness endpoint. It intentionally performs no maintenance and
// returns no session/configuration details.
export async function GET() {
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    { ok: dbOk, database: dbOk ? "connected" : "unreachable" },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
