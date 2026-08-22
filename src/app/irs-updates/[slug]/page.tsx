import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { getPublishedUpdateBySlug } from "@/lib/agency-updates/sync";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CaseImpactPanel } from "@/components/case-impact-panel";
import { Kicker } from "@/components/accent";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const update = await getPublishedUpdateBySlug(slug);
  return { title: update ? update.title : "IRS update" };
}

export default async function UpdateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const update = await getPublishedUpdateBySlug(slug);
  if (!update) notFound();
  const user = await getCurrentUser();
  const cases = user
    ? await db.case.findMany({
        where: { userId: user.id, status: { notIn: ["closed", "resolved"] } },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true },
      })
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf7]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <Link href="/irs-updates" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
          ← All updates
        </Link>
        <div className="mt-6">
          <Kicker>{update.sourceAgency}</Kicker>
        </div>
        <h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-slate-900">{update.title}</h1>
        <p className="mt-2 text-xs text-slate-400">
          Published {update.publishedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {update.syncedAt ? ` · Synced ${update.syncedAt.toLocaleDateString("en-US")}` : ""}
        </p>
        {update.summary && <p className="mt-6 text-base leading-relaxed text-slate-700">{update.summary}</p>}
        <div className="prose-simple mt-6 whitespace-pre-wrap text-slate-700">{update.body || update.summary}</div>
        {update.sourceUrl && (
          <p className="mt-8 text-sm">
            <a href={update.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-800">
              Read the official {update.sourceAgency} source ↗
            </a>
          </p>
        )}

        <div className="mt-10">
          {user ? (
            <CaseImpactPanel userId={user.id} updateId={update.id} cases={cases} />
          ) : (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-5 text-sm text-indigo-950">
              <p className="font-semibold">Want to know if this affects your situation?</p>
              <p className="mt-2 text-indigo-900/80">
                Sign in on a Plus or Pro plan to get a personalized impact analysis against your open case.
              </p>
              <Link href="/login" className="mt-3 inline-block font-semibold text-indigo-700 underline">
                Sign in →
              </Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
