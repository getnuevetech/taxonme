import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, ProgressBar, EmptyState } from "@/components/ui";
import { startFormAction, deleteFormSubmissionAction } from "@/actions/forms";
import Link from "next/link";

export const metadata = { title: "IRS forms" };

export default async function FormsPage() {
  const user = await requireUser();
  const [templates, submissions] = await Promise.all([
    db.irsFormTemplate.findMany({ where: { isPublished: true }, orderBy: { sortOrder: "asc" } }),
    db.formSubmission.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { template: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="IRS forms, minus the headache"
        subtitle="Answer simple questions one at a time — like a quiz — and we assemble the real form for you."
      />

      {submissions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-slate-900">Continue where you left off</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {submissions.map((s) => (
              <Card key={s.id}>
                <CardBody>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">Form {s.template.formNumber}</p>
                    <Badge color={s.status === "completed" ? "green" : "amber"}>
                      {s.status === "completed" ? "Completed" : `${s.progressPct}% done`}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500">{s.template.title}</p>
                  <div className="mt-3"><ProgressBar value={s.progressPct} /></div>
                  <div className="mt-3 flex items-center justify-between">
                    <Link
                      href={`/app/forms/fill/${s.id}${s.status === "completed" ? "?done=1" : ""}`}
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      {s.status === "completed" ? "View completed form →" : "Continue →"}
                    </Link>
                    <form action={deleteFormSubmissionAction.bind(null, s.id)}>
                      <button className="text-xs text-slate-400 hover:text-red-600">Delete</button>
                    </form>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      )}

      <h2 className="mb-3 text-base font-semibold text-slate-900">Available forms</h2>
      {templates.length === 0 ? (
        <EmptyState title="No forms available yet" body="The team is preparing simplified versions of the most common IRS forms." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => {
            const steps = JSON.parse(t.stepsJson || "[]") as unknown[];
            return (
              <Card key={t.id} className="transition hover:border-indigo-300">
                <CardBody>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-slate-900">Form {t.formNumber}</p>
                    <Badge>{steps.length} quick steps</Badge>
                  </div>
                  <p className="font-medium text-slate-700">{t.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{t.description}</p>
                  <form action={startFormAction.bind(null, t.id)} className="mt-4">
                    <button className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                      Start — it&apos;s like a quiz →
                    </button>
                  </form>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
