import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminArea, isAdmin } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { logoutAction } from "@/actions/auth";

const NAV: { area: string; href: string; label: string; section: string }[] = [
  { area: "admin.dashboard", href: "/admin", label: "Overview", section: "General" },
  { area: "admin.cases", href: "/admin/cases", label: "Cases", section: "General" },
  { area: "admin.users", href: "/admin/users", label: "Users", section: "People" },
  { area: "admin.admins", href: "/admin/admins", label: "Admin roles", section: "People" },
  { area: "admin.consultants", href: "/admin/consultants", label: "Consultants", section: "People" },
  { area: "admin.assignments", href: "/admin/assignments", label: "Assignments", section: "People" },
  { area: "admin.ai", href: "/admin/ai-providers", label: "AI providers", section: "Intelligence" },
  { area: "admin.pipelines", href: "/admin/pipelines", label: "AI pipelines", section: "Intelligence" },
  { area: "admin.knowledge", href: "/admin/knowledge", label: "IRS knowledge base", section: "Intelligence" },
  { area: "admin.plans", href: "/admin/plans", label: "Plans & access", section: "Commerce" },
  { area: "admin.payments", href: "/admin/payments", label: "Payment gateways", section: "Commerce" },
  { area: "admin.content", href: "/admin/content", label: "Content & agreements", section: "Content" },
  { area: "admin.forms", href: "/admin/forms", label: "IRS form templates", section: "Content" },
  { area: "admin.settings", href: "/admin/settings", label: "App settings", section: "System" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/app");
  const appName = await getSetting("app.name", "TaxOnMe");
  const items = NAV.filter((n) => hasAdminArea(user, n.area));
  const sections = Array.from(new Set(items.map((i) => i.section)));

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold">T</span>
            {appName} <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">Admin</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400">{user.email}{user.role === "super_admin" ? " · Super admin" : ""}</span>
            <Link href="/" className="text-slate-300 hover:text-white">View site</Link>
            <form action={logoutAction}>
              <button className="font-medium text-slate-300 hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-6 space-y-5">
            {sections.map((section) => (
              <div key={section}>
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{section}</p>
                {items
                  .filter((i) => i.section === section)
                  .map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
                    >
                      {item.label}
                    </Link>
                  ))}
              </div>
            ))}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
