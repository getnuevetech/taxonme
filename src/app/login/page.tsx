import Link from "next/link";
import { SiteHeader } from "@/components/site-nav";
import { LoginForm } from "@/components/auth-forms";
import { getSetting } from "@/lib/settings";
import { sanitizeAuthNext, setAuthNextCookie } from "@/lib/guest";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: nextRaw } = await searchParams;
  const next = sanitizeAuthNext(nextRaw) || "";
  if (next) await setAuthNextCookie(next);
  const googleClientId = await getSetting("auth.google_client_id", "");
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-center text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sign in to your account</p>
        {next.startsWith("/app/qa/") && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            After you sign in we will take you back to this conversation.
          </div>
        )}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {googleClientId && (
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
          <LoginForm next={next} />
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          New here?{" "}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="font-medium text-indigo-600 underline"
          >
            Create a free account
          </Link>
        </p>
      </main>
    </div>
  );
}
