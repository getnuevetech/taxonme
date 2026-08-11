import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { ButtonLink } from "@/components/ui";
import { HeroCarousel } from "@/components/hero-carousel";
import { getSettingsMap } from "@/lib/settings";
import {
  IconDocument, IconChat, IconLetter, IconClock, IconForm, IconUsers,
  IconShield, IconSparkle, IconUpload, IconCompass, IconCheckCircle,
} from "@/components/icons";

export default async function HomePage() {
  const s = await getSettingsMap([
    "app.name",
    "app.tagline",
    "home.hero_title",
    "home.hero_subtitle",
    "home.cta_primary",
    "home.cta_secondary",
    "home.hero_images",
  ]);
  const appName = s["app.name"] ?? "TaxOnMe";
  let heroImages: string[] = [];
  try {
    const parsed = JSON.parse(s["home.hero_images"] ?? "[]");
    if (Array.isArray(parsed)) heroImages = parsed.map(String);
  } catch {
    heroImages = [];
  }
  if (heroImages.length === 0) heroImages = ["/hero/hero-1.png", "/hero/hero-2.png", "/hero/hero-3.png"];

  const steps = [
    { icon: <IconChat className="h-7 w-7" />, title: "Tell us what happened", body: "In your own words — no tax jargon needed. A refund that never came, a scary letter, a balance you can't pay." },
    { icon: <IconUpload className="h-7 w-7" />, title: "Add your documents", body: "Snap a photo of the IRS notice or upload your W-2, 1099, or return. Everything stays in your private vault." },
    { icon: <IconCompass className="h-7 w-7" />, title: "Follow your plan", body: "We break your situation into clear issues, deadlines, and simple next steps — like levels in a game." },
  ];

  const features = [
    { icon: <IconLetter className="h-6 w-6" />, title: "Understand any IRS letter", body: "Upload or photograph a notice. We identify the type, tax year, amount, and deadline — then explain it like a friend would." },
    { icon: <IconChat className="h-6 w-6" />, title: "Ask anything, anytime", body: "A tax assistant that answers in plain English, without judgment. No question is too basic." },
    { icon: <IconDocument className="h-6 w-6" />, title: "Response letters, drafted for you", body: "Generate a professional reply to the IRS and edit every word before you send it yourself." },
    { icon: <IconClock className="h-6 w-6" />, title: "Never miss a deadline", body: "Every date we find goes into your reminders, so nothing sneaks up on you." },
    { icon: <IconForm className="h-6 w-6" />, title: "IRS forms that feel easy", body: "Nine famous IRS forms as friendly step-by-step quizzes that rebuild the real form for you." },
    { icon: <IconUsers className="h-6 w-6" />, title: "Real professionals on standby", body: "If your case needs a licensed CPA or Enrolled Agent, we match you with one — only with your approval." },
  ];

  const trust = [
    { icon: <IconShield className="h-5 w-5" />, text: "Your documents stay private — delete anything, anytime" },
    { icon: <IconSparkle className="h-5 w-5" />, text: "Multiple AI models cross-check every amount" },
    { icon: <IconCheckCircle className="h-5 w-5" />, text: "When something can't be verified, we say so — never guess" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero: text left, rotating imagery right */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-white">
          <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-indigo-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-violet-100/60 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
                <IconSparkle className="h-3.5 w-3.5" />
                {s["app.tagline"] ?? "Your friendly tax assistant"}
              </p>
              <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl xl:text-[3.4rem]">
                {s["home.hero_title"] ?? "IRS letters and tax problems, explained like you're human"}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
                {s["home.hero_subtitle"] ??
                  `${appName} turns confusing IRS notices, refunds, and tax debt into a simple step-by-step plan. Start free — no account needed.`}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/start" className="px-7 py-3.5 text-base shadow-lg shadow-indigo-600/20">
                  {s["home.cta_primary"] ?? "Explain my tax situation"} →
                </ButtonLink>
                <ButtonLink href="/start/qa" variant="secondary" className="px-7 py-3.5 text-base">
                  {s["home.cta_secondary"] ?? "Ask a quick question"}
                </ButtonLink>
              </div>
              <ul className="mt-8 space-y-2.5">
                {trust.map((t) => (
                  <li key={t.text} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <span className="text-emerald-600">{t.icon}</span>
                    {t.text}
                  </li>
                ))}
              </ul>
            </div>
            <HeroCarousel images={heroImages} />
          </div>
        </section>

        {/* Steps */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">As easy as 1 · 2 · 3</h2>
          </div>
          <div className="relative mt-12 grid gap-8 md:grid-cols-3">
            <div className="absolute left-[8%] right-[8%] top-[3.7rem] z-10 hidden border-t-2 border-dashed border-indigo-300 md:block" />
            {steps.map((step, i) => (
              <div key={step.title} className="relative z-20 rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
                  {step.icon}
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-widest text-indigo-500">Step {i + 1}</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats band */}
        <section className="border-y border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-center text-white sm:grid-cols-3">
            <div>
              <p className="text-4xl font-extrabold">9+</p>
              <p className="mt-1 text-sm font-medium text-indigo-100">IRS forms turned into friendly quizzes</p>
            </div>
            <div>
              <p className="text-4xl font-extrabold">5</p>
              <p className="mt-1 text-sm font-medium text-indigo-100">AI models cross-checking your case</p>
            </div>
            <div>
              <p className="text-4xl font-extrabold">100%</p>
              <p className="mt-1 text-sm font-medium text-indigo-100">yours — delete your data anytime</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-indigo-600">Everything included</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Face the IRS calmly</h2>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="group rounded-3xl border border-slate-200 p-6 transition hover:border-indigo-300 hover:shadow-lg">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                    {f.icon}
                  </div>
                  <h3 className="mt-4 font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 py-14 text-center shadow-2xl">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-violet-500/30 blur-3xl" />
            <h2 className="relative text-3xl font-extrabold tracking-tight text-white">
              Worried about a letter sitting on your table?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-slate-300">
              Upload it now. In minutes you&apos;ll know what it means, what it costs, and exactly what to do next.
            </p>
            <div className="relative mt-7">
              <ButtonLink href="/start" className="px-8 py-3.5 text-base shadow-lg shadow-indigo-600/40">Start free →</ButtonLink>
            </div>
            <p className="relative mt-4 text-xs text-slate-400">Free to start · No credit card · No account needed for your first results</p>
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            Are you a CPA or tax consultant?{" "}
            <Link href="/register?type=consultant" className="font-semibold text-indigo-600 underline">
              Join our partner network
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
