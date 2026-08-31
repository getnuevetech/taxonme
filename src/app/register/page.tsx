import Link from "next/link";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site-nav";
import { RegisterForm } from "@/components/auth-forms";
import { getSetting } from "@/lib/settings";
import { getGuestSession, sanitizeAuthNext, setAuthNextCookie } from "@/lib/guest";

export const metadata = { title: "Create your account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; next?: string; thread?: string }>;
}) {
  const { type, next: nextRaw, thread } = await searchParams;
  const asConsultant = type === "consultant";
  const next =
    sanitizeAuthNext(nextRaw) ||
    (thread && /^[a-z0-9]+$/i.test(thread) ? `/app/qa/${thread}` : null) ||
    "";
  if (next) await setAuthNextCookie(next);

  const [googleClientId, guest] = await Promise.all([
    getSetting("auth.google_client_id", ""),
    getGuestSession(),
  ]);
  const agreement = await db.contentPage.findFirst({
    where: { kind: asConsultant ? "agreement_consultant" : "agreement_user", isPublished: true },
    orderBy: { version: "desc" },
    select: { slug: true, title: true },
  });
  const guestQaCount = guest ? await db.qaThread.count({ where: { guestSessionId: guest.id } }) : 0;
  const guestCaseCount = guest ? await db.case.count({ where: { guestSessionId: guest.id } }) : 0;
  const hasGuestData =
    !!guest &&
    (guest.situation.length > 0 || guest.goal.length > 0 || guestQaCount > 0 || guestCaseCount > 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-center text-2xl font-bold text-slate-900">
          {asConsultant ? "Join as a CPA / Tax Consultant" : "Create your free account"}
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          {asConsultant
            ? "Partner with us to help taxpayers who need a professional."
            : "Just the basics — no sensitive information needed."}
        </p>
        {hasGuestData && !asConsultant && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Your questions, answers, and uploads from before will stay with your new account — you will not have to start over.
            {next.startsWith("/app/qa/")
              ? " After you create the account we will take you back to this conversation."
              : ""}
          </div>
        )}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {googleClientId && !asConsultant && (
            <>
              <a
                href="/api/auth/google"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Continue with Google
              </a>
              <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
                <div className="h-px flex-1 bg-slate-200" /> or <div className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          )}
          <RegisterForm
            asConsultant={asConsultant}
            agreementSlug={agreement?.slug ?? ""}
            agreementTitle={agreement?.title ?? "Terms of Service"}
            next={next}
          />
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="font-medium text-indigo-600 underline"
          >
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
