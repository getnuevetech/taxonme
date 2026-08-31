import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, ButtonLink, Badge, EmptyState, ProgressBar } from "@/components/ui";
import { formatCaseNumber } from "@/lib/case-number";

export const metadata = { title: "My cases" };

export default async function CasesPage() {
  const user = await requireUser();
  const cases = await db.case.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { issues: true, documents: { where: { deletedAt: null } } },
  });

  return (
    <div>
      <PageHeader
        title="My cases"
        subtitle="Agency matters already before the IRS or another tax agency. Pre-filing questions live under My situations."
        actions={<ButtonLink href="/app/cases/new">Track an agency matter →</ButtonLink>}
      />
      {cases.length === 0 ? (
        <EmptyState
          title="No agency cases yet"
          body="If you are still exploring options and have not filed, start from My situations. Open a Case only when something is before the IRS or another agency."
          action={<ButtonLink href="/app/situations">My situations</ButtonLink>}
        />
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <Link key={c.id} href={`/app/cases/${c.id}`} className="block">
              <Card className="transition hover:border-indigo-300">
                <CardBody>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      <span className="mr-2 font-mono text-xs text-indigo-600">{formatCaseNumber(c.number)}</span>
                      {c.title}
                    </p>
                    <Badge color={c.status === "analyzed" ? "green" : c.status === "consultant_recommended" ? "amber" : "slate"}>
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {c.issues.length} issue{c.issues.length === 1 ? "" : "s"} · {c.documents.length} document{c.documents.length === 1 ? "" : "s"} · opened {c.createdAt.toLocaleDateString("en-US")}
                  </p>
                  <div className="mt-3 max-w-sm">
                    <ProgressBar value={c.readinessScore} label="Case readiness" />
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
