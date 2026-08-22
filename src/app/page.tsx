import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-nav";
import { ButtonLink } from "@/components/ui";
import { HeroCarousel } from "@/components/hero-carousel";
import { Accent, Kicker } from "@/components/accent";
import { getSettingsMap, getNumberSetting, getSetting } from "@/lib/settings";
import { IconShield, IconSparkle, IconCheckCircle } from "@/components/icons";
import { UpdatesSection } from "@/components/updates-section";
import { listPublishedUpdates } from "@/lib/agency-updates/sync";
import { DEFAULT_USCIS_HOMEPAGE_COUNT, SETTINGS } from "@/lib/constants";

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
  const [agencyLabel, homepageCount, latestUpdates] = await Promise.all([
    getSetting(SETTINGS.USCIS_AGENCY_LABEL, "USCIS"),
    getNumberSetting(SETTINGS.USCIS_HOMEPAGE_COUNT, DEFAULT_USCIS_HOMEPAGE_COUNT),
    listPublishedUpdates(12),
  ]);
  const homepageUpdates = latestUpdates.slice(0, Math.max(1, homepageCount || DEFAULT_USCIS_HOMEPAGE_COUNT));
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
    { n: "01", title: "Tell us what happened", body: "In your own words — no tax jargon needed. A refund that never came, a scary letter, a balance you can't pay." },
    { n: "02", title: "Add your documents", body: "Snap a photo of the IRS notice or upload your W-2, 1099, or return. We keep everything in your private vault." },
    { n: "03", title: "Get your plain-English plan", body: "We break your situation into clear issues, deadlines, and simple next steps — like levels in a game." },
  ];

  const features = [
    { title: "Understand any IRS letter", body: "Upload or photograph a notice. We identify the type, the tax year, the amount, and your deadline — then explain it like a friend would." },
    { title: "Ask anything, anytime", body: "A tax assistant that answers in plain English, without judgment. No question is too basic." },
    { title: "Response letters, drafted for you", body: "Generate a professional reply to the IRS and edit it before you send it yourself." },
    { title: "Never miss a deadline", body: "Every date we find goes into your reminders, so nothing sneaks up on you." },
    { title: "IRS forms that feel easy", body: "Fill famous IRS forms step-by-step like a quiz, then regenerate the completed standard form." },
    { title: "Real professionals on standby", body: "If your case needs a licensed CPA or Enrolled Agent, we match you with one — only with your approval." },
  ];

  const trust = [
    { icon: <IconShield className="h-5 w-5" />, text: "Your documents stay private — delete anything, anytime" },
    { icon: <IconSparkle className="h-5 w-5" />, text: "Every amount is cross-checked against your documents" },
    { icon: <IconCheckCircle className="h-5 w-5" />, text: "When something can't be verified, we say so — never guess" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#fbfaf7]">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero — editorial serif with italic accent, imagery right */}
        <section className="relative overflow-hidden border-b border-slate-200 bg-[#fbfaf7]">
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
            <div>
              <Kicker>{s["app.tagline"] ?? "Your friendly tax assistant"}</Kicker>
              <h1 className="mt-6 font-serif text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl xl:text-[4.2rem]">
                <Accent text={s["home.hero_title"] ?? "IRS letters and tax problems, explained like you're *human*."} />
              </h1>
              <p className="mt-6 max-w-md text-base leading-relaxed text-slate-600">
                {s["home.hero_subtitle"] ??
                  `${appName} turns confusing IRS notices, refunds, and tax debt into a simple step-by-step plan. Start free — no account needed.`}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/start" className="rounded-full px-7 py-3.5 text-base shadow-lg shadow-indigo-600/25">
                  {s["home.cta_primary"] ?? "Explain my tax situation"} →
                </ButtonLink>
                <ButtonLink href="/start/qa" variant="secondary" className="rounded-full px-7 py-3.5 text-base">
                  {s["home.cta_secondary"] ?? "Ask a quick question"}
                </ButtonLink>
              </div>
              <p className="mt-7 font-mono text-[11px] uppercase tracking-widest text-slate-400">
                Free to start &nbsp;·&nbsp; No credit card &nbsp;·&nbsp; Your data stays yours
              </p>
            </div>
            <HeroCarousel images={heroImages} />
          </div>
        </section>

        {/* How it works — numbered editorial rows */}
        <section id="how-it-works" className="border-b border-slate-200 bg-[#eef1fb]">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="max-w-md">
              <h2 className="font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                <Accent text="As easy as *one, two, three*" />
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                No tax jargon, no forty-page forms. Just tell us what happened — we handle the translating.
              </p>
            </div>
            <div className="mt-12 divide-y divide-slate-300/60 border-t border-slate-300/60">
              {steps.map((step) => (
                <div key={step.n} className="grid gap-3 py-9 md:grid-cols-[100px_1fr_1.2fr] md:items-baseline md:gap-8">
                  <p className="font-serif text-4xl font-medium italic text-indigo-600">{step.n}</p>
                  <h3 className="font-serif text-2xl font-bold text-slate-900">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What you get — sticky heading left, numbered list right */}
        <section id="what-you-get" className="border-b border-slate-200 bg-[#fbfaf7]">
          <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Kicker>What you get</Kicker>
              <h2 className="mt-5 font-serif text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
                <Accent text="Everything you need to face the IRS *calmly*" />
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600">
                Six quiet superpowers, one calm inbox. Built for people, not accountants.
              </p>
              <ul className="mt-8 space-y-2.5">
                {trust.map((t) => (
                  <li key={t.text} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <span className="text-emerald-600">{t.icon}</span>
                    {t.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {features.map((f, i) => (
                <div key={f.title} className="group grid grid-cols-[56px_1fr] gap-4 py-8">
                  <p className="pt-1 font-mono text-xs text-slate-400">/ {String(i + 1).padStart(2, "0")}</p>
                  <div>
                    <h3 className={`font-serif text-2xl font-bold transition ${i === 0 ? "text-indigo-600" : "text-slate-900 group-hover:text-indigo-600"}`}>
                      {f.title}
                    </h3>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">{f.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Numbers */}
        <section className="border-b border-slate-200 bg-[#fbfaf7]">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 text-center sm:grid-cols-3">
            <div>
              <p className="font-serif text-6xl font-bold italic text-indigo-600">9+</p>
              <p className="mt-2 text-sm text-slate-600">IRS forms turned into friendly quizzes</p>
            </div>
            <div>
              <p className="font-serif text-6xl font-bold italic text-indigo-600">5</p>
              <p className="mt-2 text-sm text-slate-600">Cross-checking every amount in your case</p>
            </div>
            <div>
              <p className="font-serif text-6xl font-bold italic text-indigo-600">100%</p>
              <p className="mt-2 text-sm text-slate-600">yours — delete your data anytime</p>
            </div>
          </div>
        </section>

        <UpdatesSection
          agencyLabel={agencyLabel}
          heading={`Latest ${agencyLabel} updates`}
          items={homepageUpdates.map((u) => ({
            slug: u.slug,
            title: u.title,
            summary: u.summary,
            publishedAt: u.publishedAt,
            sourceAgency: u.sourceAgency,
            sourceUrl: u.sourceUrl,
          }))}
        />

        {/* Dark closing CTA, flowing into the dark footer */}
        <section className="bg-[#0b1322]">
          <div className="mx-auto max-w-6xl px-4 pb-4 pt-20">
            <h2 className="max-w-2xl font-serif text-4xl font-bold leading-tight text-white sm:text-5xl">
              <Accent text="Worried about a letter sitting on your *table*?" accentClass="font-serif italic text-indigo-400" />
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
              Upload it now. In minutes you&apos;ll know what it means, what it costs, and exactly what to do next.
            </p>
            <div className="mt-8">
              <ButtonLink href="/start" className="rounded-full px-8 py-3.5 text-base shadow-lg shadow-indigo-600/30">
                Start free →
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Are you a CPA or tax consultant?{" "}
              <Link href="/register?type=consultant" className="font-semibold text-white underline decoration-slate-500 underline-offset-4 hover:decoration-white">
                Join our partner network
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
