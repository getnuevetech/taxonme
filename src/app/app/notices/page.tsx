import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Card, CardBody, Badge, Money, EmptyState, ButtonLink } from "@/components/ui";
import { NoticeUpload } from "@/components/notice-upload";

export const metadata = { title: "IRS notices" };

export default async function NoticesPage() {
  const user = await requireUser();
  const notices = await db.notice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="IRS notices"
        subtitle="Upload or photograph any IRS letter. We identify it, extract the key facts, and explain it in plain English."
      />
      <Card className="mb-6">
        <CardBody>
          <NoticeUpload />
        </CardBody>
      </Card>

      {notices.length === 0 ? (
        <EmptyState title="No notices yet" body="When you upload an IRS letter, its explanation will appear here." />
      ) : (
        <div className="space-y-4">
          {notices.map((n) => {
            const steps: { title: string; description: string }[] = JSON.parse(n.nextStepsJson || "[]");
            return (
              <Card key={n.id}>
                <CardBody>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {n.noticeType ? `Notice ${n.noticeType}` : "IRS notice"}
                      {n.taxYear ? ` · Tax year ${n.taxYear}` : ""}
                    </h2>
                    <div className="flex gap-2">
                      {n.amountCents !== null && <Badge color="amber"><Money cents={n.amountCents} /></Badge>}
                      {n.deadline && (
                        <Badge color="red">Respond by {n.deadline.toLocaleDateString("en-US")}</Badge>
                      )}
                      <Badge color={n.status === "explained" ? "green" : "slate"}>{n.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                  {n.explanation && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What this means</p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{n.explanation}</p>
                    </div>
                  )}
                  {steps.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your next steps</p>
                      <ol className="mt-2 space-y-2">
                        {steps.map((s, i) => (
                          <li key={i} className="flex gap-3 text-sm">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-medium text-slate-900">{s.title}</p>
                              <p className="text-slate-500">{s.description}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <ButtonLink href={`/app/letters/new?notice=${n.id}`} variant="secondary" className="!px-3 !py-1.5 text-xs">
                      Draft a response letter
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
