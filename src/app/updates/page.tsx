import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { UpdatesSection } from "@/components/updates-section";
import { listPublishedUpdates } from "@/lib/agency-updates/sync";
import { getNumberSetting, getSetting } from "@/lib/settings";
import { DEFAULT_USCIS_HOMEPAGE_COUNT, SETTINGS } from "@/lib/constants";
import { Accent, Kicker } from "@/components/accent";
import Link from "next/link";

export const metadata = { title: "USCIS updates" };

export default async function UpdatesIndexPage() {
  const [agency, updates] = await Promise.all([
    getSetting(SETTINGS.USCIS_AGENCY_LABEL, "USCIS"),
    listPublishedUpdates(100),
  ]);
  const homepageCount = await getNumberSetting(SETTINGS.USCIS_HOMEPAGE_COUNT, DEFAULT_USCIS_HOMEPAGE_COUNT);

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf7]">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-slate-200 bg-[#fbfaf7]">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <Kicker>{agency} newsroom</Kicker>
            <h1 className="mt-4 max-w-3xl font-serif text-5xl font-bold leading-tight text-slate-900">
              <Accent text={`All the latest *${agency}* updates`} />
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
              We pull official news and alerts into the app. Paid customers also get a plain-English read of how each
              update may affect their open case.
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Showing {updates.length} published update{updates.length === 1 ? "" : "s"}
              {homepageCount ? ` · homepage teaser shows ${homepageCount}` : ""}.
            </p>
          </div>
        </section>

        {updates.length === 0 ? (
          <div className="mx-auto max-w-6xl px-4 py-20 text-sm text-slate-600">
            No updates yet. An admin can sync from the {agency} feed, or the next maintenance cron will try again.
          </div>
        ) : (
          <UpdatesSection
            agencyLabel={agency}
            heading="Complete update list"
            seeAllHref="/updates"
            items={updates.map((u) => ({
              slug: u.slug,
              title: u.title,
              summary: u.summary,
              publishedAt: u.publishedAt,
              sourceAgency: u.sourceAgency,
              sourceUrl: u.sourceUrl,
            }))}
          />
        )}

        <section className="bg-[#0b1322]">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <p className="max-w-xl text-sm text-slate-300">
              Signed in on Plus or Pro? Open any update to see how it may affect your case, or jump to{" "}
              <Link href="/app/updates" className="font-semibold text-white underline decoration-slate-500 underline-offset-4">
                your updates dashboard
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
