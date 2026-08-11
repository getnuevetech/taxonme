import Link from "next/link";
import { SiteHeader } from "@/components/site-nav";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-center text-2xl font-bold text-slate-900">Forgot your password?</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Enter your email and we&apos;ll send you a link to choose a new one.
        </p>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ForgotPasswordForm />
        </div>
        <p className="mt-4 text-center text-sm text-slate-500">
          Remembered it? <Link href="/login" className="font-medium text-indigo-600 underline">Sign in</Link>
        </p>
      </main>
    </div>
  );
}
