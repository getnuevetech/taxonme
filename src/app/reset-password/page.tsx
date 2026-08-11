import Link from "next/link";
import { SiteHeader } from "@/components/site-nav";
import { ResetPasswordForm } from "@/components/auth-forms";
import { validateResetToken } from "@/lib/password-reset";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? (await validateResetToken(token)) !== null : false;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-center text-2xl font-bold text-slate-900">Choose a new password</h1>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {valid ? (
            <ResetPasswordForm token={token!} />
          ) : (
            <div className="text-center">
              <p className="text-sm text-slate-600">
                This reset link is invalid or has expired. Links are valid for 1 hour.
              </p>
              <Link href="/forgot-password" className="mt-3 inline-block text-sm font-medium text-indigo-600 underline">
                Request a new link
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
