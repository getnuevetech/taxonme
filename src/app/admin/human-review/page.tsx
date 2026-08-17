import Link from "next/link";
import { db } from "@/lib/db";
import { guardAdminPage } from "@/lib/admin-guard";
import { PageHeader, Card, CardBody, Badge } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { resolveHumanReviewItemAction } from "@/actions/admin";

export const metadata = { title: "Human review queue" };

function severityColor(severity: string): "red" | "amber" | "slate" | "indigo" {
  if (severity === "urgent") return "red";
  if (severity === "high") return "amber";
  if (severity === "low") return "slate";
  return "indigo";
}

export default async function HumanReviewPage() {
  await guardAdminPage("admin.human_review");
  const items = await db.humanReviewItem.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      case: { select: { id: true, number: true, title: true, status: true, readinessScore: true } },
      analysisVersion: { select: { version: true, status: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Human review queue"
        subtitle="High-risk, conflicting, source-missing, or professional-review AI outputs that require a person before the case should be treated as fully approved."
      />
      <Card>
        <CardBody>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">No human-review items are open or recently created.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Case</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2 pr-4">Severity</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Version</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Resolve</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4">
                        <Link href={`/admin/cases/${item.case.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                          {formatCaseNumber(item.case.number)}
                        </Link>
                        <div className="text-xs text-slate-500">{item.case.title}</div>
                        <div className="text-xs text-slate-400">Status: {item.case.status}; readiness {item.case.readinessScore}%</div>
                      </td>
                      <td className="max-w-md py-3 pr-4 text-slate-700">{item.reason}</td>
                      <td className="py-3 pr-4"><Badge color={severityColor(item.severity)}>{item.severity}</Badge></td>
                      <td className="py-3 pr-4"><Badge>{item.status}</Badge></td>
                      <td className="py-3 pr-4 text-slate-600">
                        {item.analysisVersion ? `v${item.analysisVersion.version} (${item.analysisVersion.status})` : "n/a"}
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{item.createdAt.toLocaleString("en-US")}</td>
                      <td className="min-w-80 py-3 pr-4">
                        {item.status === "open" || item.status === "assigned" ? (
                          <form action={resolveHumanReviewItemAction} className="space-y-2">
                            <input type="hidden" name="id" value={item.id} />
                            <textarea
                              name="professionalFact"
                              rows={2}
                              placeholder="Optional professional-confirmed fact or resolution note"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                            />
                            <div className="flex gap-2">
                              <button name="decision" value="resolved" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white">
                                Resolve
                              </button>
                              <button name="decision" value="dismissed" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600">
                                Dismiss
                              </button>
                            </div>
                          </form>
                        ) : (
                          <span className="text-xs text-slate-400">Closed {item.resolvedAt?.toLocaleString("en-US") ?? ""}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
