import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getGuestSession } from "@/lib/guest";
import { getCurrentUser } from "@/lib/auth";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { Card, CardBody, StateMark, ButtonLink, Badge } from "@/components/ui";

export const metadata = { title: "Your first results" };

export default async function GuestResultPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: caseId } = await searchParams;
  const user = await getCurrentUser();
  if (user && caseId) redirect(`/app/cases/${caseId}`);
  const guest = await getGuestSession();
  if (!caseId || !guest) redirect("/start");

  const c = await db.case.findFirst({
    where: { id: caseId, guestSessionId: guest.id },
    include: { issues: { orderBy: { createdAt: "asc" } }, documents: { where: { deletedAt: null } } },
  });
  if (!c) redirect("/start");

  // Teaser: show the count and the first issue; full details require registration.
  const [first, ...locked] = c.issues;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
        <div className="text-center">
          <Badge color="green">Analysis complete</Badge>
          <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
            We found {c.issues.length} {c.issues.length === 1 ? "thing" : "things"} worth looking at
          </h1>
          <p className="mt-2 text-slate-600">Here&apos;s your first result. Create a free account to unlock the full breakdown and your step-by-step plan.</p>
        </div>

        {first && (
          <Card className="mt-8">
            <CardBody>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {first.taxYear ? `${first.taxYear} · ` : ""}{first.title}
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{first.description}</p>
                </div>
                <StateMark state={first.state} />
              </div>
            </CardBody>
          </Card>
        )}

        {locked.length > 0 && (
          <div className="relative mt-4">
            <div className="pointer-events-none select-none space-y-4 blur-sm">
              {locked.map((issue) => (
                <Card key={issue.id}>
                  <CardBody>
                    <h2 className="text-lg font-semibold text-slate-900">{issue.title}</h2>
                    <p className="mt-2 text-sm text-slate-600">{issue.description.slice(0, 120)}…</p>
                  </CardBody>
                </Card>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-xl bg-white/95 px-6 py-4 text-center shadow-lg ring-1 ring-slate-200">
                <p className="font-semibold text-slate-900">{locked.length} more {locked.length === 1 ? "result" : "results"} + your action plan</p>
                <p className="text-sm text-slate-500">Free account · takes 30 seconds</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-indigo-600 p-8 text-center text-white">
          <h2 className="text-xl font-bold">Unlock your full analysis</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-indigo-100">
            Your answers and {c.documents.length > 0 ? `${c.documents.length} uploaded document${c.documents.length > 1 ? "s" : ""}` : "results"} will be attached to your account automatically — nothing is lost.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <ButtonLink href="/register" variant="secondary" className="px-6 py-3">Create free account</ButtonLink>
            <Link href="/login" className="inline-flex items-center px-4 text-sm font-medium text-indigo-100 underline hover:text-white">
              I already have one
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
