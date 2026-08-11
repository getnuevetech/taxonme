import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Badge } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";

export const metadata = { title: "Cases" };

export default async function AdminCasesPage() {
  await guardAdminPage("admin.cases");
  const cases = await db.case.findMany({
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      issues: { select: { id: true } },
      documents: { where: { deletedAt: null }, select: { id: true } },
      runs: { select: { id: true, stepResults: { select: { id: true }, take: 1 } } },
    },
  });

  const statusColor = (s: string) =>
    s === "analyzed" ? "green" : s === "consultant_recommended" ? "amber" : s === "analyzing" ? "blue" : "slate";

  return (
    <div>
      <PageHeader
        title="Cases"
        subtitle="Every case on the platform, its analysis engine, and whether professional review was flagged."
      />
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Engine</th>
              <th className="px-4 py-3">Issues</th>
              <th className="px-4 py-3">Docs</th>
              <th className="px-4 py-3">Readiness</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cases.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No cases yet.</td></tr>
            )}
            {cases.map((c) => {
              const usedAi = c.runs.some((r) => r.stepResults.length > 0);
              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="max-w-xs px-4 py-3">
                    <Link href={`/admin/cases/${c.id}`} className="font-medium text-indigo-600 underline">
                      {c.title.slice(0, 60)}
                    </Link>
                    <p className="font-mono text-xs text-slate-400">{formatCaseNumber(c.number)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.user ? `${c.user.firstName} ${c.user.lastName}`.trim() || c.user.email : <Badge>guest</Badge>}
                  </td>
                  <td className="px-4 py-3"><Badge color={statusColor(c.status)}>{c.status.replace(/_/g, " ")}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge color={usedAi ? "green" : "amber"}>{usedAi ? "AI pipeline" : "rule-based"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.issues.length}</td>
                  <td className="px-4 py-3 text-slate-600">{c.documents.length}</td>
                  <td className="px-4 py-3 text-slate-600">{c.readinessScore}%</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.updatedAt.toLocaleString("en-US")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
