import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge, Stat } from "@/components/ui";
import { purgeSystemLogsAction } from "@/actions/admin";

export const metadata = { title: "System logs" };

const LEVEL_COLOR: Record<string, string> = { error: "red", warning: "amber", info: "slate" };

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; source?: string; q?: string }>;
}) {
  await guardAdminPage("admin.logs");
  const f = await searchParams;
  const where: Prisma.SystemLogWhereInput = {};
  if (f.level) where.level = f.level;
  if (f.source) where.source = f.source;
  if (f.q?.trim()) {
    where.OR = [
      { message: { contains: f.q.trim(), mode: "insensitive" } },
      { detail: { contains: f.q.trim(), mode: "insensitive" } },
    ];
  }

  const day = new Date(Date.now() - 24 * 3600000);
  const [logs, errors24, warnings24, sources] = await Promise.all([
    db.systemLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    db.systemLog.count({ where: { level: "error", createdAt: { gte: day } } }),
    db.systemLog.count({ where: { level: "warning", createdAt: { gte: day } } }),
    db.systemLog.findMany({ distinct: ["source"], select: { source: true }, orderBy: { source: "asc" } }),
  ]);
  const matched = await db.systemLog.count({ where });

  const chip = (label: string, params: string, active: boolean) => (
    <Link
      href={`/admin/logs${params}`}
      className={`rounded-full px-3 py-1.5 text-xs font-medium ${active ? "bg-slate-800 text-white" : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}
    >
      {label}
    </Link>
  );

  return (
    <div>
      <PageHeader
        title="System logs"
        subtitle="AI model call failures, email/payment/webhook errors, and other operational events. Logs auto-purge after 30 days."
        actions={
          <form action={purgeSystemLogsAction}>
            <button className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Purge logs older than 30 days
            </button>
          </form>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Errors — last 24h" value={errors24} />
        <Stat label="Warnings — last 24h" value={warnings24} />
        <Stat label="Matched entries" value={matched} sub="showing most recent 200" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chip("All", "", !f.level && !f.source)}
        {chip("Errors", "?level=error", f.level === "error")}
        {chip("Warnings", "?level=warning", f.level === "warning")}
        {sources.map((s) => chip(s.source.replace(/_/g, " "), `?source=${s.source}`, f.source === s.source))}
        <form method="get" className="ml-auto flex gap-2">
          <input
            name="q"
            defaultValue={f.q ?? ""}
            placeholder="Search message or detail…"
            className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">Search</button>
        </form>
      </div>

      <div className="space-y-2">
        {logs.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            No log entries match. That usually means everything is running clean.
          </p>
        )}
        {logs.map((l) => (
          <details key={l.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
              <Badge color={LEVEL_COLOR[l.level] ?? "slate"}>{l.level}</Badge>
              <Badge>{l.source.replace(/_/g, " ")}</Badge>
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{l.message}</span>
              <span className="shrink-0 text-xs text-slate-400">{l.createdAt.toLocaleString("en-US")}</span>
            </summary>
            {(l.detail || l.userId) && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                {l.userId && <p className="mb-1 text-xs text-slate-500">User: {l.userId}</p>}
                {l.detail && (
                  <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">{l.detail}</pre>
                )}
              </div>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}
