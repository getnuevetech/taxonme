import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { db } from "@/lib/db";
import { logoutAction } from "@/actions/auth";

import { GuideWidget } from "@/components/guide-widget";

const NAV = [
  { href: "/app", label: "Overview" },
  { href: "/app/cases", label: "My cases" },
  { href: "/app/irs-updates", label: "IRS updates" },
  { href: "/app/notices", label: "IRS notices" },
  { href: "/app/documents", label: "Document vault" },
  { href: "/app/forms", label: "IRS forms" },
  { href: "/app/letters", label: "Response letters" },
  { href: "/app/deadlines", label: "Deadlines" },
  { href: "/app/qa", label: "Ask the assistant" },
  { href: "/app/consultants", label: "My consultant" },
  { href: "/app/support", label: "Support tickets" },
  { href: "/app/irs-account", label: "IRS online account" },
  { href: "/app/billing", label: "Plan & billing" },
  { href: "/app/profile", label: "Profile" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "consultant") redirect("/consultant");
  const appName = await getSetting("app.name", "TaxOnMe");
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/app" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">T</span>
            {appName}
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/app" className="relative text-sm text-slate-600 hover:text-slate-900">
              Notifications
              {unread > 0 && (
                <span className="absolute -right-3 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
            <span className="hidden text-sm text-slate-500 sm:block">
              {user.firstName || user.email}
            </span>
            <form action={logoutAction}>
              <button className="text-sm font-medium text-slate-500 hover:text-slate-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8">
        <aside className="hidden w-52 shrink-0 md:block">
          <nav className="sticky top-20 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <GuideWidget />
    </div>
  );
}
