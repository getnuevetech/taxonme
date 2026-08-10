import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { ButtonLink, Card, CardBody } from "@/components/ui";
import { getSettingsMap } from "@/lib/settings";

export default async function HomePage() {
  const s = await getSettingsMap([
    "app.name",
    "app.tagline",
    "home.hero_title",
    "home.hero_subtitle",
    "home.cta_primary",
    "home.cta_secondary",
  ]);
  const appName = s["app.name"] ?? "TaxOnMe";

  const steps = [
    { n: "1", title: "Tell us what happened", body: "In your own words — no tax jargon needed. A refund that never came, a scary letter, a balance you can't pay." },
    { n: "2", title: "Add your documents", body: "Snap a photo of the IRS notice or upload your W-2, 1099, or return. We keep everything in your private vault." },
    { n: "3", title: "Get your plain-English plan", body: "We break your situation into clear issues, deadlines, and simple next steps — like levels in a game." },
  ];

  const features = [
    { title: "Understand any IRS letter", body: "Upload or photograph a notice. We identify the type, the tax year, the amount, and your deadline — then explain it like a friend would." },
    { title: "Ask anything, anytime", body: "A tax assistant that answers in plain English, without judgment. No question is too basic." },
    { title: "Response letters, drafted for you", body: "Generate a professional reply to the IRS and edit it before you send it yourself." },
    { title: "Never miss a deadline", body: "Every date we find goes into your reminders, so nothing sneaks up on you." },
    { title: "IRS forms that feel easy", body: "Fill famous IRS forms step-by-step like a quiz, then regenerate the completed standard form." },
    { title: "Real professionals when you need one", body: "If your case needs a licensed CPA or Enrolled Agent, we connect you — only with your approval." },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center">
            <p className="mx-auto mb-4 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              {s["app.tagline"] ?? "Your friendly tax assistant"}
            </p>
            <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              {s["home.hero_title"] ?? "IRS letters and tax problems, explained like you're human"}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              {s["home.hero_subtitle"] ??
                `${appName} turns confusing IRS notices, refunds, and tax debt into a simple step-by-step plan. Start free — no account needed.`}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/start" className="px-6 py-3 text-base">
                {s["home.cta_primary"] ?? "Explain my tax situation"} →
              </ButtonLink>
              <ButtonLink href="/start/qa" variant="secondary" className="px-6 py-3 text-base">
                {s["home.cta_secondary"] ?? "Ask a quick question"}
              </ButtonLink>
            </div>
            <p className="mt-4 text-xs text-slate-400">Free to start · No credit card · Your data stays yours</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-bold text-slate-900">As easy as 1 · 2 · 3</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <Card key={step.n}>
                <CardBody>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
                    {step.n}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-center text-2xl font-bold text-slate-900">Everything you need to face the IRS calmly</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900">Worried about a letter sitting on your table?</h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-600">
            Upload it now. In minutes you&apos;ll know what it means, what it costs, and exactly what to do next.
          </p>
          <div className="mt-6">
            <ButtonLink href="/start" className="px-6 py-3 text-base">Start free →</ButtonLink>
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Are you a CPA or tax consultant?{" "}
            <Link href="/register?type=consultant" className="font-medium text-indigo-600 underline">
              Join our partner network
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
