import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { logoutAction } from "@/actions/auth";

export default async function ConsultantLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "consultant") redirect("/app");
  const appName = await getSetting("app.name", "TaxOnMe");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/consultant" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-white">T</span>
            {appName} <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Consultant</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/consultant" className="text-slate-600 hover:text-slate-900">Clients</Link>
            <Link href="/consultant/profile" className="text-slate-600 hover:text-slate-900">My profile</Link>
            <Link href="/consultant/onboarding" className="text-slate-600 hover:text-slate-900">My credentials</Link>
            <Link href="/consultant/experience" className="text-slate-600 hover:text-slate-900">Experience</Link>
            <Link href="/consultant/billing" className="text-slate-600 hover:text-slate-900">Billing</Link>
            <form action={logoutAction}>
              <button className="font-medium text-slate-500 hover:text-slate-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
