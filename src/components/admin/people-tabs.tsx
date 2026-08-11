import Link from "next/link";
import { db } from "@/lib/db";

// Shared group navigation for people management: each account type has its
// own dedicated section — customers, consultants, and admins are never mixed.
export async function PeopleTabs({ active }: { active: "customers" | "consultants" | "admins" }) {
  const [customers, consultants, admins] = await Promise.all([
    db.user.count({ where: { role: "user", status: { not: "deleted" } } }),
    db.user.count({ where: { role: "consultant", status: { not: "deleted" } } }),
    db.user.count({ where: { role: { in: ["admin", "super_admin"] }, status: { not: "deleted" } } }),
  ]);
  const tabs = [
    { key: "customers", href: "/admin/users", label: "Customers", count: customers },
    { key: "consultants", href: "/admin/consultants", label: "CPA / Consultants", count: consultants },
    { key: "admins", href: "/admin/admins", label: "Admin users", count: admins },
  ] as const;

  return (
    <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-slate-200/70 p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            active === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {t.label}
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${active === t.key ? "bg-indigo-100 text-indigo-700" : "bg-slate-300/70 text-slate-600"}`}>
            {t.count}
          </span>
        </Link>
      ))}
    </div>
  );
}
