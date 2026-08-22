import Link from "next/link";
import { Kicker } from "@/components/accent";

export type UpdateCardItem = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: Date;
  sourceAgency: string;
  sourceUrl?: string;
};

export function UpdatesSection({
  items,
  agencyLabel = "IRS",
  heading = "Latest updates",
  seeAllHref = "/updates",
}: {
  items: UpdateCardItem[];
  agencyLabel?: string;
  heading?: string;
  seeAllHref?: string;
}) {
  if (items.length === 0) return null;
  return (
    <section id="irs-updates" className="border-b border-slate-200 bg-[#fbfaf7]">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <Kicker>{agencyLabel} news</Kicker>
            <h2 className="mt-4 font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
              {heading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Fresh notices and news from {agencyLabel}, pulled into the app so you can spot changes that matter.
            </p>
          </div>
          <Link href={seeAllHref} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
            View all updates →
          </Link>
        </div>
        <div className="mt-10 divide-y divide-slate-200 border-t border-slate-200">
          {items.map((item) => (
            <article key={item.slug} className="grid gap-2 py-7 md:grid-cols-[140px_1fr] md:gap-8">
              <p className="pt-1 font-mono text-[11px] uppercase tracking-widest text-slate-400">
                {item.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              <div>
                <h3 className="font-serif text-2xl font-bold text-slate-900">
                  <Link href={`/updates/${item.slug}`} className="hover:text-indigo-600">
                    {item.title}
                  </Link>
                </h3>
                {item.summary && (
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{item.summary}</p>
                )}
                <p className="mt-3 text-xs font-medium text-slate-400">{item.sourceAgency}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
