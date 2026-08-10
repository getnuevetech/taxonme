import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { IntakeWizard } from "@/components/intake-wizard";

export const metadata = { title: "Get help with your tax situation" };

export default function StartPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 px-4 py-12">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Let&apos;s figure this out together</h1>
          <p className="mt-2 text-slate-600">Three quick steps. No account, no jargon, no judgment.</p>
        </div>
        <IntakeWizard />
      </main>
      <SiteFooter />
    </div>
  );
}
