/**
 * Package AC — Lifecycle / FAQ authorship honesty.
 * Run: npx tsx scripts/phase-package-ac-check.ts
 */
import Module from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

const CASE_FIRST_PLAN =
  /Start by creating a case|Start a case<\/strong>|we'll build your step-by-step plan|turn everything into issues and a step-by-step plan|builds a step-by-step path forward|simple step-by-step plan/i;

async function main() {
  const root = process.cwd();
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");

  const analysisFaq =
    seed.match(/Q: How does the analysis work\?[\s\S]*?(?=Q: How do payment plans)/)?.[0] ?? "";
  assert.ok(analysisFaq.length > 40);
  assert.doesNotMatch(analysisFaq, CASE_FIRST_PLAN);
  assert.match(analysisFaq, /Situation/i);
  assert.match(analysisFaq, /Depth grows with evidence|thin intake/i);

  const howItWorks =
    seed.match(/slug: "how-it-works",[\s\S]*?body: `([\s\S]*?)`,/)?.[1] ?? "";
  assert.ok(howItWorks.length > 40);
  assert.doesNotMatch(howItWorks, /builds a step-by-step path forward/i);
  assert.match(howItWorks, /Situation/i);
  assert.match(howItWorks, /agency matter|before the IRS/i);
  assert.match(seed, /Package AC: also refresh how-it-works|Package AC: refresh how-it-works/i);

  const welcome =
    seed.match(/key: "account_created"[\s\S]*?bodyHtml:[\s\S]*?(?=key: "password_reset")/)?.[0] ?? "";
  assert.ok(welcome.length > 40);
  assert.doesNotMatch(welcome, /Start a case/i);
  assert.doesNotMatch(welcome, /step-by-step plan/i);
  assert.match(welcome, /Situation/i);
  assert.match(seed, /Package AC: refresh welcome email/);

  assert.match(seed, /depth grows with your evidence/i);
  assert.match(seed, /Package AC: refresh hero subtitle/);

  const guide = readFileSync(join(root, "src/lib/guide.ts"), "utf8");
  assert.doesNotMatch(guide, /Start by creating a case/);
  assert.doesNotMatch(guide, /label: "Start a case"/);
  assert.match(guide, /Continue with my situation/);
  assert.match(guide, /Track this government case/);
  assert.match(guide, /Start from a Situation/);

  const impact = readFileSync(join(root, "src/components/case-impact-panel.tsx"), "utf8");
  assert.doesNotMatch(impact, /Start a case →/);
  assert.match(impact, /\/app\/situations/);
  assert.match(impact, /My situations/);

  const home = readFileSync(join(root, "src/app/page.tsx"), "utf8");
  assert.doesNotMatch(home, /simple step-by-step plan/);
  assert.match(home, /depth grows with your evidence/i);

  const result = readFileSync(join(root, "src/app/start/result/page.tsx"), "utf8");
  assert.doesNotMatch(result, /step-by-step plan/);
  assert.match(result, /Situation/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AC-LIFECYCLE-AUTHORSHIP-HONESTY.md"), "utf8"),
    /Package AC/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AC\*\*.*Lifecycle|authorship|Situation/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ac"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ac/);

  const { db } = await import("../src/lib/db");
  try {
    // Refresh analysis FAQ answer without wiping Package AA payment-plan honesty.
    const existingFaq = await db.contentPage.findUnique({ where: { slug: "faq" } });
    const analysisAnswer = `Q: How does the analysis work?
We start from what you told us and any documents you add. Depth grows with evidence: first we clarify your Situation, then we verify amounts against IRS reference material when documents support it. Unsupported modules stay empty — we never invent a full resolution plan from thin intake alone.`;
    let faqBody = existingFaq?.body ?? analysisAnswer;
    if (/Q: How does the analysis work\?/.test(faqBody)) {
      faqBody = faqBody.replace(
        /Q: How does the analysis work\?[\s\S]*?(?=Q: How do payment plans|Q: How do I cancel|$)/,
        `${analysisAnswer}\n\n`,
      );
    } else {
      faqBody = `${faqBody.trim()}\n\n${analysisAnswer}`;
    }
    await db.contentPage.upsert({
      where: { slug: "faq" },
      update: { body: faqBody, title: "Frequently asked questions", isPublished: true },
      create: {
        slug: "faq",
        title: "Frequently asked questions",
        kind: "page",
        body: faqBody,
        isPublished: true,
      },
    });
    const faq = await db.contentPage.findUnique({ where: { slug: "faq" } });
    assert.match(faq!.body, /Situation/i);
    assert.doesNotMatch(faq!.body, /turn everything into issues and a step-by-step plan/i);
    // Force stale how-it-works then refresh.
    await db.contentPage.upsert({
      where: { slug: "how-it-works" },
      update: {
        body: "Our analysis engine builds a step-by-step path forward.",
        title: "How it works",
        isPublished: true,
      },
      create: {
        slug: "how-it-works",
        title: "How it works",
        kind: "page",
        body: "Our analysis engine builds a step-by-step path forward.",
        isPublished: true,
      },
    });
    const honestHow = `TaxOnMe helps you understand tax questions in plain English.

1. Ask or describe what happened — in your own words (Question → Situation).
2. Tell us your goal — what a good outcome looks like.
3. Add evidence when you have it — IRS notices, transcripts, W-2s, 1099s, returns.

We map options in a Situation workspace. Depth grows as facts and documents arrive. A Case (agency matter) is for when something is already before the IRS or another tax agency — not the default first click. When numbers can't be verified, we say so — we never guess.`;
    const mid = await db.contentPage.findUnique({ where: { slug: "how-it-works" } });
    assert.match(mid!.body, /step-by-step path/i);
    if (/builds a step-by-step path|step-by-step path forward/i.test(mid!.body) || !/Situation/i.test(mid!.body)) {
      await db.contentPage.update({
        where: { slug: "how-it-works" },
        data: { body: honestHow },
      });
    }
    const afterHow = await db.contentPage.findUnique({ where: { slug: "how-it-works" } });
    assert.match(afterHow!.body, /Situation/i);
    assert.doesNotMatch(afterHow!.body, /builds a step-by-step path forward/i);

    await db.setting.upsert({
      where: { key: "home.hero_subtitle" },
      update: {
        value:
          "TaxOnMe turns confusing IRS notices, refunds, and tax debt into a simple step-by-step plan. Start free — no account needed.",
      },
      create: {
        key: "home.hero_subtitle",
        value:
          "TaxOnMe turns confusing IRS notices, refunds, and tax debt into a simple step-by-step plan. Start free — no account needed.",
        group: "branding",
        label: "Homepage hero subtitle",
        description: "",
        type: "text",
      },
    });
    await db.setting.updateMany({
      where: { key: "home.hero_subtitle", value: { contains: "simple step-by-step plan" } },
      data: {
        value:
          "TaxOnMe explains IRS notices, refunds, and tax questions in plain English — depth grows with your evidence. Start free — no account needed.",
      },
    });
    const hero = await db.setting.findUnique({ where: { key: "home.hero_subtitle" } });
    assert.doesNotMatch(hero!.value, /simple step-by-step plan/);
    assert.match(hero!.value, /depth grows with your evidence/i);

    const welcomeHtml = `<ul>
  <li><strong>Start from your Situation</strong> — describe what happened and we map options; open a Case only when something is before the IRS or another agency.</li>
</ul>`;
    await db.messageTemplate.upsert({
      where: { key: "account_created" },
      update: { bodyHtml: welcomeHtml, subject: "Welcome", name: "Welcome — account created", kind: "event" },
      create: {
        key: "account_created",
        name: "Welcome — account created",
        kind: "event",
        subject: "Welcome",
        bodyHtml: welcomeHtml,
      },
    });
    const tmpl = await db.messageTemplate.findUnique({ where: { key: "account_created" } });
    assert.doesNotMatch(tmpl!.bodyHtml, /Start a case/i);
    assert.match(tmpl!.bodyHtml, /Situation/i);
  } finally {
    await db.$disconnect();
  }

  console.log("phase-package-ac-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
