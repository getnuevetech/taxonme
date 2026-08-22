import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { UpdatesSection } from "@/components/updates-section";
import { listPublishedUpdatesForListing } from "@/lib/agency-updates/sync";
import { getSetting } from "@/lib/settings";
import { SETTINGS } from "@/lib/constants";
import { Accent } from "@/components/accent";
import Link from "next/link";

export const metadata = { title: "IRS updates" };

export default async function IrsUpdatesIndexPage() {
  const [agency, updates] = await Promise.all([
    getSetting(SETTINGS.IRS_AGENCY_LABEL, "IRS"),
    listPublishedUpdatesForListing(200),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf7]">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-slate-200 bg-[#fbfaf7]">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h1 className="max-w-3xl font-serif text-5xl font-bold leading-tight text-slate-900">
              <Accent text={`${agency} updates`} />
            </h1>
          </div>
        </section>

        {updates.length === 0 ? (
          <div className="mx-auto max-w-6xl px-4 py-20 text-sm text-slate-600">
            No updates yet. An admin can sync from the {agency} newsroom, or the next maintenance cron will try again.
          </div>
        ) : (
          <UpdatesSection
            agencyLabel={agency}
            variant="list"
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
              <Link
                href="/app/irs-updates"
                className="font-semibold text-white underline decoration-slate-500 underline-offset-4"
              >
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
