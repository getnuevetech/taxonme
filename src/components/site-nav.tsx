import Link from "next/link";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { db } from "@/lib/db";
import { ButtonLink } from "./ui";

export async function SiteHeader() {
  const [appName, user] = await Promise.all([getSetting("app.name", "TaxOnMe"), getCurrentUser()]);
  const dashboardHref = user
    ? isAdmin(user)
      ? "/admin"
      : user.role === "consultant"
        ? "/consultant"
        : "/app"
    : null;
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-slate-900">
          {appName}
          <sup className="ml-0.5 text-[10px] font-normal">®</sup>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
          <Link href="/#how-it-works" className="hover:text-slate-900">How it works</Link>
          <Link href="/#what-you-get" className="hover:text-slate-900">What you get</Link>
          <Link href="/updates" className="hover:text-slate-900">USCIS updates</Link>
          <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          {dashboardHref ? (
            <ButtonLink href={dashboardHref} className="rounded-full">My dashboard →</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" className="rounded-full">Sign in</ButtonLink>
              <ButtonLink href="/start" className="rounded-full">Start free →</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const appName = await getSetting("app.name", "TaxOnMe");
  const disclaimer = await getSetting(
    "app.disclaimer",
    `${appName} is a tax assistant that helps you understand your tax situation. We are not the IRS, a CPA firm, or a law firm, and we do not provide legal, accounting, or financial advice.`,
  );
  const pages = await db.contentPage.findMany({
    where: { isPublished: true, kind: { in: ["terms", "privacy", "policy", "legal", "page"] } },
    orderBy: { title: "asc" },
    select: { slug: true, title: true },
    take: 8,
  });
  return (
    <footer className="overflow-hidden bg-[#0b1322] text-slate-300">
      <div className="mx-auto max-w-6xl px-4">
        {/* Giant outlined wordmark, as in the editorial reference design */}
        <div className="select-none pt-16 text-center" aria-hidden>
          <span className="text-outline font-serif text-[clamp(4rem,14vw,11rem)] font-extrabold leading-none">
            {appName}
          </span>
          <sup className="text-outline font-serif text-2xl">®</sup>
        </div>
        <div className="mt-10 flex flex-wrap items-start justify-between gap-6 border-t border-slate-700/60 pt-8">
          <p className="font-serif text-lg font-bold text-white">
            {appName}
            <sup className="ml-0.5 text-[9px] font-normal">®</sup>
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
            {pages.map((p) => (
              <Link key={p.slug} href={`/p/${p.slug}`} className="hover:text-white">
                {p.title}
              </Link>
            ))}
            <Link href="/updates" className="hover:text-white">
              USCIS updates
            </Link>
          </nav>
        </div>
        <p className="mt-6 max-w-3xl pb-10 text-xs leading-relaxed text-slate-500">{disclaimer}</p>
      </div>
    </footer>
  );
}
