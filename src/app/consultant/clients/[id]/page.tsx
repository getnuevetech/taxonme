import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, StateMark, ProgressBar, EmptyState } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { CaseReportCta } from "@/components/case-report-cta";

export default async function ClientWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const assignment = await db.consultantAssignment.findFirst({
    where: { id, consultantId: user.id, status: "active" },
    include: {
      user: {
        include: {
          cases: { include: { issues: true, pathSteps: { orderBy: { sortOrder: "asc" } } }, orderBy: { updatedAt: "desc" } },
          documents: { where: { deletedAt: null, docKind: { not: "avatar" } }, orderBy: { uploadedAt: "desc" } },
        },
      },
    },
  });
  if (!assignment) notFound();
  const client = assignment.user;

  return (
    <div>
      <PageHeader
        title={`${client.firstName} ${client.lastName}`}
        subtitle={`${client.email}${client.phone ? ` · ${client.phone}` : ""} — shared with you under an active connection agreement`}
      />
      {client.bio && (
        <Card className="mb-6"><CardBody><p className="text-sm text-slate-600">{client.bio}</p></CardBody></Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Cases</h2>
          {client.cases.length === 0 ? (
            <EmptyState title="No cases" />
          ) : (
            <div className="space-y-4">
              {client.cases.map((c) => (
                <Card key={c.id}>
                  <CardBody>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">
                        <span className="mr-2 font-mono text-xs text-indigo-600">{formatCaseNumber(c.number)}</span>
                        {c.title}
                      </p>
                      <Badge>{c.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Goal: {c.goal || "—"}</p>
                    <div className="mt-3"><ProgressBar value={c.readinessScore} label="Readiness" /></div>
                    <div className="mt-3 space-y-2">
                      {c.issues.map((i) => (
                        <div key={i.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                          <span className="text-slate-700">{i.taxYear ? `${i.taxYear} · ` : ""}{i.title}</span>
                          <StateMark state={i.state} />
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/consultant/clients/${assignment.id}/cases/${c.id}`}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Open full analysis →
                      </Link>
                      <CaseReportCta caseId={c.id} returnPath={`/consultant/clients/${assignment.id}`} />
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-slate-900">Shared documents</h2>
          {client.documents.length === 0 ? (
            <EmptyState title="No documents shared" />
          ) : (
            <Card>
              <CardBody>
                <ul className="divide-y divide-slate-100">
                  {client.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between py-2">
                      <div>
                        <Link href={`/api/files/${d.id}`} target="_blank" className="text-sm font-medium text-indigo-600 underline">
                          {d.fileName}
                        </Link>
                        <p className="text-xs text-slate-400">{d.uploadedAt.toLocaleDateString("en-US")}</p>
                      </div>
                      <Badge>{d.docKind}</Badge>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
