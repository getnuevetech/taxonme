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
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">T</span>
          {appName}
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href="/start" className="hover:text-slate-900">Get help</Link>
          <Link href="/start/qa" className="hover:text-slate-900">Ask a question</Link>
          <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
          <Link href="/p/how-it-works" className="hover:text-slate-900">How it works</Link>
        </nav>
        <div className="flex items-center gap-2">
          {dashboardHref ? (
            <ButtonLink href={dashboardHref}>My dashboard</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
              <ButtonLink href="/start">Start free</ButtonLink>
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
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <p className="text-sm font-semibold text-slate-900">{appName}</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            {pages.map((p) => (
              <Link key={p.slug} href={`/p/${p.slug}`} className="hover:text-slate-900">
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-slate-400">{disclaimer}</p>
      </div>
    </footer>
  );
}
