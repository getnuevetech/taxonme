import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";
import { CaseAnalysisView } from "@/components/case-analysis-view";
import { CaseComments } from "@/components/case-comments";

// Consultants see EXACTLY what the customer sees — same analysis, findings,
// walkthroughs, and plan — in read-and-review mode with the case discussion.
export default async function ConsultantCaseViewPage({
  params,
}: {
  params: Promise<{ id: string; caseId: string }>;
}) {
  const { id, caseId } = await params;
  const user = await requireUser();
  const assignment = await db.consultantAssignment.findFirst({
    where: { id, consultantId: user.id, status: "active" },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!assignment) notFound();
  const c = await db.case.findFirst({
    where: { id: caseId, userId: assignment.user.id },
    select: { id: true, title: true, number: true, createdAt: true },
  });
  if (!c) notFound();

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`Case ${formatCaseNumber(c.number)} · ${assignment.user.firstName} ${assignment.user.lastName} · opened ${c.createdAt.toLocaleDateString("en-US")} — you see the same analysis as your client`}
        actions={
          <div className="flex gap-2">
            <a href={`/api/cases/${c.id}/report`} target="_blank" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Case report ↗
            </a>
            <Link href={`/consultant/clients/${assignment.id}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              ← Client workspace
            </Link>
          </div>
        }
      />
      <CaseAnalysisView caseId={c.id} viewer={{ role: "consultant", userId: user.id }} />
      <CaseComments caseId={c.id} viewer={{ role: "consultant", userId: user.id }} />
    </div>
  );
}
