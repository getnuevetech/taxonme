/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PROMPTS } from "../src/lib/ai/prompts";

const db = new PrismaClient();

async function seedSettings() {
  const settings: [string, string, string, string, string][] = [
    // key, value, group, label, description
    ["app.name", "TaxOnMe", "branding", "App name", "Shown in the header, titles, and emails."],
    ["app.tagline", "Your friendly tax assistant", "branding", "Tagline", "Short slogan shown on the landing page."],
    ["app.url", "http://localhost:3000", "general", "App URL", "Public base URL, used for OAuth callbacks and payment redirects."],
    ["app.disclaimer", "TaxOnMe is a tax assistant that helps you understand your tax situation and IRS documents in plain English. We are not the IRS, a CPA firm, or a law firm, and we do not provide legal, accounting, or financial advice. For high-stakes decisions, consult a licensed professional.", "branding", "Footer disclaimer", "Compliance disclaimer shown in the site footer."],
    ["home.hero_title", "IRS letters and tax problems, explained like you're human", "branding", "Homepage hero title", ""],
    ["home.hero_subtitle", "TaxOnMe turns confusing IRS notices, refunds, and tax debt into a simple step-by-step plan. Start free — no account needed.", "branding", "Homepage hero subtitle", ""],
    ["home.cta_primary", "Explain my tax situation", "branding", "Primary call to action", ""],
    ["home.cta_secondary", "Ask a quick question", "branding", "Secondary call to action", ""],
    ["auth.google_client_id", "", "auth", "Google OAuth client ID", "Leave empty to hide the Google sign-in button."],
    ["auth.google_client_secret", "", "auth", "Google OAuth client secret", ""],
    ["billing.free_plan_key", "free", "billing", "Free plan key", "Plan applied to users without a paid subscription."],
    ["irs.account_url", "https://www.irs.gov/your-account", "irs", "IRS online account URL", "Official page users are guided to for creating their IRS individual account."],
    ["analysis.expected_documents", "3", "analysis", "Expected documents per case", "Used by the deterministic case-readiness formula."],
    ["consultants.auto_approve_enabled", "false", "consultants", "Auto-approve consultants", "Automatically approve CPA/EA applications meeting requirements."],
    ["consultants.auto_approve_min_years", "3", "consultants", "Auto-approve minimum years", "Minimum years of experience for automated approval."],
  ];
  for (const [key, value, group, label, description] of settings) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value, group, label, description, type: key.includes("secret") ? "secret" : "text" },
    });
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@mytaxonme.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";
  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: "Super",
      lastName: "Admin",
      role: "super_admin",
      passwordHash: await bcrypt.hash(password, 10),
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Super admin: ${email} / ${password}`);
}

async function seedAdminRoles() {
  // Example roles the super admin can edit, delete, or extend.
  const roles = [
    {
      name: "Operations",
      description: "Day-to-day platform operations: customers, cases, consultants.",
      areas: ["admin.dashboard", "admin.cases", "admin.users", "admin.consultants", "admin.assignments", "admin.notifications"],
    },
    {
      name: "Finance",
      description: "Billing: plans, payment gateways, and transactions.",
      areas: ["admin.dashboard", "admin.plans", "admin.payments", "admin.transactions"],
    },
    {
      name: "Content manager",
      description: "Site content, agreements, form templates, and the IRS knowledge base.",
      areas: ["admin.dashboard", "admin.content", "admin.forms", "admin.knowledge"],
    },
    {
      name: "AI engineer",
      description: "AI providers, pipelines, and the knowledge base.",
      areas: ["admin.dashboard", "admin.ai", "admin.pipelines", "admin.knowledge", "admin.cases"],
    },
  ];
  for (const r of roles) {
    await db.adminRole.upsert({
      where: { name: r.name },
      update: {},
      create: { name: r.name, description: r.description, areasJson: JSON.stringify(r.areas) },
    });
  }
}

async function seedPlansAndFeatures() {
  const features: [string, string, string, number][] = [
    ["notice.upload", "Upload & photograph IRS notices", "notices", 1],
    ["notice.explain", "Plain-English notice explanations", "notices", 2],
    ["documents.upload", "Document vault storage", "documents", 3],
    ["documents.explain", "Tax document explanations (W-2/1099/1040)", "documents", 4],
    ["case.analysis", "AI case analysis", "analysis", 5],
    ["case.full_results", "Full analysis results & action plan", "analysis", 6],
    ["qa.chat", "AI tax Q&A", "assistant", 7],
    ["letters.generate", "Response-letter generator", "letters", 8],
    ["deadlines.reminders", "Deadline tracking & reminders", "deadlines", 9],
    ["vault.storage", "Secure document vault", "documents", 10],
    ["forms.wizard", "Simplified IRS form wizards", "forms", 11],
    ["consultant.referral", "CPA/EA referral service", "consultants", 12],
  ];
  for (const [key, name, category, sortOrder] of features) {
    await db.featureDef.upsert({ where: { key }, update: {}, create: { key, name, category, sortOrder } });
  }

  const plans = [
    {
      key: "free",
      name: "Free",
      description: "Understand what's going on — no credit card needed.",
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      sortOrder: 0,
      badge: "",
      features: {
        "notice.upload": { enabled: true, limit: 2 },
        "notice.explain": { enabled: true, limit: 2 },
        "documents.upload": { enabled: true, limit: 5 },
        "case.analysis": { enabled: true, limit: 1 },
        "qa.chat": { enabled: true, limit: 10 },
        "vault.storage": { enabled: true, limit: 5 },
        "deadlines.reminders": { enabled: true, limit: null },
      },
    },
    {
      key: "plus",
      name: "Plus",
      description: "The full toolkit for handling one tax situation end to end.",
      priceMonthlyCents: 1900,
      priceYearlyCents: 18900,
      sortOrder: 1,
      badge: "Most popular",
      features: {
        "notice.upload": { enabled: true, limit: null },
        "notice.explain": { enabled: true, limit: null },
        "documents.upload": { enabled: true, limit: null },
        "documents.explain": { enabled: true, limit: null },
        "case.analysis": { enabled: true, limit: null },
        "case.full_results": { enabled: true, limit: null },
        "qa.chat": { enabled: true, limit: null },
        "letters.generate": { enabled: true, limit: 3 },
        "deadlines.reminders": { enabled: true, limit: null },
        "vault.storage": { enabled: true, limit: null },
        "forms.wizard": { enabled: true, limit: null },
      },
    },
    {
      key: "pro",
      name: "Pro",
      description: "Everything, unlimited — plus professional referrals.",
      priceMonthlyCents: 4900,
      priceYearlyCents: 49900,
      sortOrder: 2,
      badge: "",
      features: {
        "notice.upload": { enabled: true, limit: null },
        "notice.explain": { enabled: true, limit: null },
        "documents.upload": { enabled: true, limit: null },
        "documents.explain": { enabled: true, limit: null },
        "case.analysis": { enabled: true, limit: null },
        "case.full_results": { enabled: true, limit: null },
        "qa.chat": { enabled: true, limit: null },
        "letters.generate": { enabled: true, limit: null },
        "deadlines.reminders": { enabled: true, limit: null },
        "vault.storage": { enabled: true, limit: null },
        "forms.wizard": { enabled: true, limit: null },
        "consultant.referral": { enabled: true, limit: null },
      },
    },
  ];

  for (const p of plans) {
    const plan = await db.subscriptionPlan.upsert({
      where: { key: p.key },
      update: {},
      create: {
        key: p.key,
        name: p.name,
        description: p.description,
        priceMonthlyCents: p.priceMonthlyCents,
        priceYearlyCents: p.priceYearlyCents,
        sortOrder: p.sortOrder,
        badge: p.badge,
      },
    });
    for (const [featureKey, cfg] of Object.entries(p.features)) {
      await db.planFeature.upsert({
        where: { planId_featureKey: { planId: plan.id, featureKey } },
        update: {},
        create: { planId: plan.id, featureKey, enabled: cfg.enabled, limitValue: cfg.limit },
      });
    }
  }
}

async function seedGateway() {
  const existing = await db.paymentGatewayConfig.count();
  if (existing === 0) {
    await db.paymentGatewayConfig.create({
      data: {
        name: "Manual / development",
        kind: "manual",
        mode: "test",
        isActive: true,
        isDefault: true,
        configJson: "{}",
      },
    });
    await db.paymentGatewayConfig.create({
      data: {
        name: "Stripe",
        kind: "stripe",
        mode: "test",
        isActive: false,
        isDefault: false,
        configJson: JSON.stringify({ secretKey: "", publishableKey: "", webhookSecret: "", currency: "usd", appUrl: "http://localhost:3000" }, null, 2),
      },
    });
  }
}

async function seedAiAndPipelines() {
  const providerDefs = [
    { name: "OpenAI GPT-5.6 Sol", kind: "openai_compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-sol", supportsVision: true, notes: "Flagship reasoning model for complex professional work." },
    { name: "OpenAI GPT-5.6 Terra", kind: "openai_compatible", baseUrl: "https://api.openai.com/v1", model: "gpt-5.6-terra", supportsVision: false, notes: "Fast model used for presentation-layer structuring." },
    { name: "Anthropic Claude Sonnet 5", kind: "anthropic", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-5", supportsVision: true, notes: "Strong document analysis with visual PDF understanding." },
    { name: "Anthropic Claude Opus 5", kind: "anthropic", baseUrl: "https://api.anthropic.com", model: "claude-opus-5", supportsVision: true, notes: "High-capability independent analysis / review." },
    { name: "Google Gemini 3.1 Pro", kind: "google", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-3.1-pro", supportsVision: true, notes: "Long-context document reasoning, native PDF understanding." },
  ];
  const providers: Record<string, string> = {};
  for (const p of providerDefs) {
    const existing = await db.aiProvider.findFirst({ where: { name: p.name } });
    const row = existing ?? (await db.aiProvider.create({ data: { ...p, apiKey: "" } }));
    providers[p.name] = row.id;
  }

  const stages: { key: string; name: string; description: string; steps: { provider: string; role: string; prompt: string; order: number }[] }[] = [
    {
      key: "summary",
      name: "1 · Summary analysis",
      description: "Analyzes the user's situation summary with 2–3 models (fact extractor, case interpreter, skeptic) and merges results into one simple result.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "fact_extractor", prompt: DEFAULT_PROMPTS.fact_extractor, order: 0 },
        { provider: "Anthropic Claude Sonnet 5", role: "interpreter", prompt: DEFAULT_PROMPTS.interpreter, order: 1 },
        { provider: "Google Gemini 3.1 Pro", role: "skeptic", prompt: DEFAULT_PROMPTS.skeptic, order: 2 },
      ],
    },
    {
      key: "goal",
      name: "2 · Goal analysis",
      description: "Analyzes what the user wants to achieve and merges model outputs into a single result.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "fact_extractor", prompt: DEFAULT_PROMPTS.fact_extractor, order: 0 },
        { provider: "Anthropic Claude Sonnet 5", role: "interpreter", prompt: DEFAULT_PROMPTS.interpreter, order: 1 },
      ],
    },
    {
      key: "document",
      name: "3 · Document analysis",
      description: "Two models independently extract each document into the standardized TaxOnMe schema; disagreements are marked 'verification required' — never guessed.",
      steps: [
        { provider: "Anthropic Claude Sonnet 5", role: "extractor_a", prompt: DEFAULT_PROMPTS.extractor_a, order: 0 },
        { provider: "Google Gemini 3.1 Pro", role: "extractor_b", prompt: DEFAULT_PROMPTS.extractor_b, order: 1 },
      ],
    },
    {
      key: "situation",
      name: "4 · Tax situation analysis",
      description: "Grounded in the IRS knowledge base: each model answers the same structured questions (issue, evidence, IRS basis, conditions, confidence, professional review).",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "analyst", prompt: DEFAULT_PROMPTS.analyst, order: 0 },
        { provider: "Anthropic Claude Opus 5", role: "reviewer", prompt: DEFAULT_PROMPTS.reviewer, order: 1 },
        { provider: "Google Gemini 3.1 Pro", role: "reviewer", prompt: DEFAULT_PROMPTS.reviewer, order: 2 },
      ],
    },
    {
      key: "presenter",
      name: "5 · Results presentation",
      description: "A single model converts internal analysis into structured JSON. The UI renders it deterministically — the AI never writes the customer's screen.",
      steps: [
        { provider: "OpenAI GPT-5.6 Terra", role: "presenter", prompt: DEFAULT_PROMPTS.presenter, order: 0 },
      ],
    },
    {
      key: "qa",
      name: "AI tax Q&A",
      description: "Conversational assistant grounded in the IRS knowledge base.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "assistant", prompt: DEFAULT_PROMPTS.assistant, order: 0 },
      ],
    },
    {
      key: "notice",
      name: "IRS notice explanation",
      description: "Identifies notice type, tax year, amount, and deadline; produces a plain-English explanation and next steps.",
      steps: [
        { provider: "Anthropic Claude Sonnet 5", role: "analyst", prompt: DEFAULT_PROMPTS.notice_explainer, order: 0 },
      ],
    },
    {
      key: "letter",
      name: "Response letter drafting",
      description: "Drafts a professional IRS response letter the user reviews and edits.",
      steps: [
        { provider: "OpenAI GPT-5.6 Sol", role: "assistant", prompt: DEFAULT_PROMPTS.letter_writer, order: 0 },
      ],
    },
  ];

  for (const s of stages) {
    const stage = await db.pipelineStage.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, name: s.name, description: s.description },
    });
    const stepCount = await db.pipelineStep.count({ where: { stageKey: stage.key } });
    if (stepCount === 0) {
      for (const step of s.steps) {
        await db.pipelineStep.create({
          data: {
            stageKey: stage.key,
            providerId: providers[step.provider],
            role: step.role,
            promptTemplate: step.prompt,
            sortOrder: step.order,
          },
        });
      }
    }
  }
}

async function seedContent() {
  const pages = [
    {
      slug: "how-it-works",
      title: "How it works",
      kind: "page",
      body: `TaxOnMe helps you understand and resolve tax situations in plain English.

1. Tell us what happened — in your own words.
2. Tell us your goal — what a great outcome looks like.
3. Add documents — IRS notices, W-2s, 1099s, returns, transcripts.

Our analysis engine breaks your situation into clear issues, verifies amounts against your documents, and builds a step-by-step path forward. When numbers can't be verified, we say so — we never guess.

If your case needs a licensed professional, we can connect you with a vetted CPA or Enrolled Agent — only with your approval.`,
    },
    {
      slug: "terms-of-service",
      title: "Terms of Service",
      kind: "terms",
      body: `Welcome to TaxOnMe. By using this service you agree to these terms.

1. TaxOnMe is a tax assistant, not a tax preparer, CPA firm, law firm, or government agency. We help you understand your tax situation and IRS documents; we do not provide legal, accounting, or financial advice.
2. You are responsible for the accuracy of the information you provide and for any filings or payments you make.
3. Analysis results are informational. Verify important amounts and deadlines against official IRS records.
4. You may delete your documents and your account at any time.

(Replace this placeholder text with your reviewed terms in the admin backend.)`,
    },
    {
      slug: "privacy-policy",
      title: "Privacy Policy",
      kind: "privacy",
      body: `Your privacy matters.

- We collect only the basic information needed to run your account: name, email, phone (optional), and the documents you choose to upload.
- Your documents are visible only to you, and to a consultant only after you explicitly approve the connection.
- You can delete your files and your entire profile at any time.

(Replace this placeholder text with your reviewed policy in the admin backend.)`,
    },
    {
      slug: "user-agreement",
      title: "User Agreement",
      kind: "agreement_user",
      body: `By creating a TaxOnMe account you acknowledge:

1. TaxOnMe is a tax assistant that provides plain-English guidance, not professional tax, legal, or financial advice.
2. Information you provided before registering will be attached to your account and visible only to you.
3. You control your data: you can delete documents or your entire account at any time.
4. You will verify important amounts and deadlines against official IRS records before acting.`,
    },
    {
      slug: "consultant-agreement",
      title: "Consultant Partner Agreement",
      kind: "agreement_consultant",
      body: `By registering as a CPA / Tax Consultant partner you agree:

1. The credentials you provide are accurate and current, and you will keep them updated.
2. You will handle client materials confidentially and only for the engaged purpose.
3. Client connections require the client's explicit consent before any material is shared.
4. TaxOnMe may verify your credentials and approve or suspend partner accounts at its discretion.`,
    },
    {
      slug: "connection-agreement",
      title: "Client–Consultant Connection Agreement",
      kind: "agreement_connection",
      body: `This agreement governs the connection between a TaxOnMe user and a consultant.

1. Both parties must accept before any sensitive material is shared.
2. The consultant may view the client's cases and shared documents solely to assist with the client's tax situation.
3. Either party or a TaxOnMe administrator may revoke the connection at any time, ending access immediately.
4. Confidentiality obligations survive the end of the connection.`,
    },
  ];
  for (const p of pages) {
    await db.contentPage.upsert({
      where: { slug: p.slug },
      update: {},
      create: { ...p, isPublished: true },
    });
  }
}

async function seedKnowledge() {
  const sources = [
    {
      title: "CP2000 — Underreported income notice",
      sourceType: "notice_guide",
      reference: "CP2000",
      tags: "notice, underreported, income, proposed amount",
      content: "A CP2000 notice is sent when income or payment information the IRS has on file (from employers, banks, and other payers) doesn't match the amounts reported on the tax return. It is a PROPOSED change, not a bill or an audit. The taxpayer can agree, partially agree, or disagree with documentation. A response is normally due within 30 days of the notice date (60 days if outside the U.S.). If the taxpayer does not respond, the IRS issues a Statutory Notice of Deficiency (CP3219A). Common causes: missing 1099 income, corrected W-2s, brokerage cost-basis differences.",
    },
    {
      title: "CP14 — Balance due notice",
      sourceType: "notice_guide",
      reference: "CP14",
      tags: "notice, balance due, first notice",
      content: "A CP14 is the first notice that a taxpayer owes tax. It shows the tax assessed, payments credited, penalties, and interest. Payment is generally requested within 21 days. Options if the taxpayer cannot pay in full: short-term payment plan (up to 180 days), long-term installment agreement (Form 9465 or IRS online payment agreement), currently-not-collectible status, or offer in compromise in hardship cases. Interest and failure-to-pay penalties continue to accrue until paid.",
    },
    {
      title: "CP49 — Refund applied to other taxes",
      sourceType: "notice_guide",
      reference: "CP49",
      tags: "refund, offset, applied, prior year",
      content: "A CP49 notice tells the taxpayer that all or part of an expected refund was applied (offset) to another federal tax debt from a different tax year. The notice shows which year the refund was applied to and any remaining refund. If the taxpayer disagrees with the underlying debt, they should review the account transcript for the year in question. Refunds can also be offset for state taxes, child support, or federal student loans through the Treasury Offset Program (those generate a different notice from the Bureau of the Fiscal Service).",
    },
    {
      title: "LT11 / Letter 1058 — Final notice of intent to levy",
      sourceType: "notice_guide",
      reference: "LT11",
      tags: "levy, urgent, collection, due process, appeal",
      content: "LT11 is a FINAL notice of intent to levy and notice of the right to a Collection Due Process (CDP) hearing. The taxpayer has 30 days from the notice date to request a CDP hearing (Form 12153) or make payment arrangements before the IRS can levy wages, bank accounts, or other property. This is urgent. Setting up an installment agreement or having a pending CDP request generally stops levy action. Professional review is strongly recommended at this stage.",
    },
    {
      title: "IRS account transcript transaction codes",
      sourceType: "rule",
      reference: "TC codes",
      tags: "transcript, transaction codes, 846, 826, 570, 971",
      content: "Key IRS account transcript transaction codes: TC 150 = tax return filed and tax assessed. TC 806 = withholding credit. TC 846 = refund issued (with date and amount). TC 826 = credit transferred to another tax period (refund used to pay another year's debt). TC 570 = additional account action pending (refund hold). TC 971 = notice issued. TC 971/977 = amended return received. TC 276 = failure-to-pay penalty. TC 196 = interest assessed. TC 480 = offer in compromise pending. TC 971 with 'collection due process' = CDP request received. Comparing TC 846 amounts against the refund claimed on the return reveals offsets and adjustments.",
    },
    {
      title: "Installment agreements (payment plans)",
      sourceType: "rule",
      reference: "Form 9465 / IRC 6159",
      tags: "payment plan, installment agreement, balance due",
      content: "Individuals who owe $50,000 or less in combined tax, penalties, and interest can generally set up a long-term installment agreement online (streamlined, no financial statement). Short-term plans (up to 180 days) are available for balances under $100,000. Setup fees vary and are lower for direct-debit agreements; low-income taxpayers may qualify for fee waivers. While an agreement is in effect the failure-to-pay penalty rate is reduced. Defaulting (missing payments or new unpaid balances) can terminate the agreement. A pending installment agreement request generally suspends levy action.",
    },
    {
      title: "First-time penalty abatement",
      sourceType: "rule",
      reference: "FTA / IRM 20.1.1.3.3.2.1",
      tags: "penalty, abatement, relief, first time",
      content: "First-time abatement (FTA) provides administrative relief from failure-to-file, failure-to-pay, and failure-to-deposit penalties when the taxpayer: (1) has a clean compliance history for the prior 3 years (no significant penalties), (2) has filed all currently required returns or valid extensions, and (3) has paid or arranged to pay any tax due (an installment agreement in good standing qualifies). FTA can be requested by phone or in writing. Interest on the abated penalty is also removed, but interest on the tax itself is statutory and cannot be abated for reasonable cause. Reasonable-cause relief is a separate path for circumstances such as serious illness or disaster.",
    },
    {
      title: "Getting IRS transcripts",
      sourceType: "rule",
      reference: "Transcripts",
      tags: "transcript, account, wage and income, online account",
      content: "Taxpayers can get transcripts free through their IRS individual online account (immediate), by mail (Get Transcript by Mail), or by filing Form 4506-T. The ACCOUNT transcript shows all account activity by transaction code — assessments, payments, refunds, offsets, holds, and notices. The RETURN transcript shows most line items from the return as filed. The WAGE & INCOME transcript shows W-2s, 1099s, and other information returns the IRS received from payers — useful for reconstructing income for unfiled years. Records go back further for account transcripts (often 10+ years) than return transcripts (generally current + 3 prior years).",
    },
    {
      title: "Unfiled returns and substitute for return",
      sourceType: "rule",
      reference: "SFR / IRC 6020(b)",
      tags: "unfiled, substitute for return, late filing",
      content: "When a required return is not filed, the IRS may prepare a Substitute for Return (SFR) using payer information — with single/married-filing-separate status and no itemized deductions or credits, usually overstating the true tax. Filing an accurate original return generally replaces the SFR assessment. Refunds are only payable if claimed within 3 years of the return due date (or 2 years of payment). Getting compliant (typically the last 6 years of returns per IRS Policy Statement 5-133) is a prerequisite for most resolution options such as installment agreements and offers in compromise.",
    },
  ];
  for (const s of sources) {
    const exists = await db.knowledgeSource.findFirst({ where: { title: s.title } });
    if (!exists) await db.knowledgeSource.create({ data: s });
  }
}

async function seedFormTemplates() {
  const templates = [
    {
      formNumber: "W-4",
      title: "Employee's Withholding Certificate",
      description: "Tell your employer how much tax to take out of your paycheck. 4 quick steps.",
      category: "individual",
      sortOrder: 0,
      stepsJson: JSON.stringify([
        {
          id: "you",
          title: "Let's start with you",
          help: "This is the easy part — just who you are.",
          fields: [
            { key: "first_name", label: "First name and middle initial", type: "text", required: true },
            { key: "last_name", label: "Last name", type: "text", required: true },
            { key: "ssn", label: "Social Security number", type: "text", placeholder: "000-00-0000", required: true, hint: "Only stored in your own generated form." },
            { key: "address", label: "Home address", type: "text", required: true },
            { key: "city_state_zip", label: "City, state, and ZIP", type: "text", required: true },
          ],
        },
        {
          id: "status",
          title: "Your household",
          help: "This decides your tax brackets — pick the one that fits.",
          fields: [
            {
              key: "filing_status", label: "How will you file your taxes?", type: "select", required: true,
              options: [
                { value: "Single or Married filing separately", label: "Single (or married, filing separately)" },
                { value: "Married filing jointly or Qualifying surviving spouse", label: "Married, filing together" },
                { value: "Head of household", label: "Head of household (single + you pay most home costs for a dependent)" },
              ],
            },
            { key: "multiple_jobs", label: "Do you (or your spouse) have more than one job?", type: "boolean", hint: "If yes, the IRS suggests checking box 2(c) so both jobs withhold at the right rate." },
          ],
        },
        {
          id: "dependents",
          title: "Kids & dependents",
          help: "Dependents can lower your withholding — that means more money in each paycheck.",
          fields: [
            { key: "children_count", label: "How many children under 17 live with you?", type: "number", hint: "Worth $2,000 each on this form." },
            { key: "other_dependents_count", label: "How many other dependents do you support?", type: "number", hint: "Worth $500 each." },
          ],
        },
        {
          id: "extras",
          title: "Fine-tuning (optional)",
          help: "Most people skip this step. Only fill it if it applies to you.",
          fields: [
            { key: "other_income", label: "Other yearly income not from jobs (interest, dividends…)", type: "money" },
            { key: "deductions", label: "Extra deductions you expect beyond the standard deduction", type: "money" },
            { key: "extra_withholding", label: "Extra tax to withhold each paycheck", type: "money" },
          ],
        },
      ]),
      outputTemplate: `FORM W-4 — EMPLOYEE'S WITHHOLDING CERTIFICATE (Tax Year {{tax_year}})
=================================================================

STEP 1 — PERSONAL INFORMATION
  (a) Name:            {{first_name}} {{last_name}}
      Address:         {{address}}
                       {{city_state_zip}}
  (b) SSN:             {{ssn}}
  (c) Filing status:   {{filing_status}}

STEP 2 — MULTIPLE JOBS OR SPOUSE WORKS
  More than one job / spouse works: {{multiple_jobs}}

STEP 3 — CLAIM DEPENDENTS
  Qualifying children under 17: {{children_count}}  x $2,000
  Other dependents:             {{other_dependents_count}}  x $500

STEP 4 — OTHER ADJUSTMENTS (OPTIONAL)
  (a) Other income (not from jobs):  $ {{other_income}}
  (b) Deductions:                    $ {{deductions}}
  (c) Extra withholding per period:  $ {{extra_withholding}}

STEP 5 — SIGNATURE
  Sign: ______________________________   Date: ____________

Give the completed form to your employer's payroll department.
Compare against the official IRS Form W-4 before submitting.`,
    },
    {
      formNumber: "9465",
      title: "Installment Agreement Request",
      description: "Ask the IRS for a monthly payment plan you can afford. 3 quick steps.",
      category: "individual",
      sortOrder: 1,
      stepsJson: JSON.stringify([
        {
          id: "you",
          title: "About you",
          help: "Same details as on your tax return.",
          fields: [
            { key: "name", label: "Your full name (as on your return)", type: "text", required: true },
            { key: "ssn", label: "Social Security number", type: "text", required: true },
            { key: "address", label: "Current address", type: "text", required: true },
            { key: "phone", label: "Daytime phone", type: "text" },
          ],
        },
        {
          id: "debt",
          title: "What you owe",
          help: "You can find these on your IRS notice or account transcript.",
          fields: [
            { key: "tax_form", label: "Which return is this for?", type: "select", required: true, options: [
              { value: "Form 1040", label: "My personal tax return (1040)" },
              { value: "Other", label: "Something else" },
            ] },
            { key: "tax_years", label: "Which tax year(s)?", type: "text", required: true, placeholder: "e.g. 2024" },
            { key: "amount_owed", label: "Total amount you owe", type: "money", required: true },
          ],
        },
        {
          id: "plan",
          title: "Your monthly plan",
          help: "Pick an amount you can really afford — the IRS charges less penalty while a plan is active. Your total divided by 72 is the minimum they'll usually accept.",
          fields: [
            { key: "down_payment", label: "Can you pay anything today?", type: "money", hint: "Even a small amount reduces interest." },
            { key: "monthly_payment", label: "Monthly payment you're proposing", type: "money", required: true },
            { key: "payment_day", label: "Day of the month to pay (1–28)", type: "number", required: true },
            { key: "direct_debit", label: "Pay automatically from your bank account?", type: "boolean", hint: "Direct debit has the lowest setup fee and you can't forget a payment." },
          ],
        },
      ]),
      outputTemplate: `FORM 9465 — INSTALLMENT AGREEMENT REQUEST
=========================================

PART I — TAXPAYER INFORMATION
  Name:      {{name}}
  SSN:       {{ssn}}
  Address:   {{address}}
  Phone:     {{phone}}

TAX INFORMATION
  Return type:        {{tax_form}}
  Tax year(s):        {{tax_years}}
  Total amount owed:  $ {{amount_owed}}

PROPOSED AGREEMENT
  Payment made with this request:  $ {{down_payment}}
  Proposed monthly payment:        $ {{monthly_payment}}
  Payment date each month:         {{payment_day}}
  Direct debit requested:          {{direct_debit}}

SIGNATURE
  Sign: ______________________________   Date: ____________

Tip: If you owe $50,000 or less you can usually set this up faster
in your IRS online account without mailing this form.
Compare against the official IRS Form 9465 before submitting.`,
    },
    {
      formNumber: "4506-T",
      title: "Request for Transcript of Tax Return",
      description: "Ask the IRS to send your tax transcripts — the records that show what they have on file. 3 quick steps.",
      category: "individual",
      sortOrder: 2,
      stepsJson: JSON.stringify([
        {
          id: "you",
          title: "About you",
          help: "Use the name and address the IRS has on file (from your last return).",
          fields: [
            { key: "name", label: "Your full name", type: "text", required: true },
            { key: "ssn", label: "Social Security number", type: "text", required: true },
            { key: "address", label: "Current address", type: "text", required: true },
            { key: "previous_address", label: "Address on your last return (if different)", type: "text" },
          ],
        },
        {
          id: "what",
          title: "Which records do you need?",
          help: "The Account Transcript is the one that shows refunds, payments, and offsets — usually the most useful.",
          fields: [
            { key: "transcript_type", label: "Type of transcript", type: "select", required: true, options: [
              { value: "Account Transcript (6b)", label: "Account transcript — payments, refunds, and changes (most useful)" },
              { value: "Return Transcript (6a)", label: "Return transcript — what you filed" },
              { value: "Record of Account (6c)", label: "Record of account — both combined" },
              { value: "Wage and Income (8)", label: "Wage & income — W-2s and 1099s the IRS received" },
            ] },
            { key: "tax_years", label: "Which year(s)? (up to 4)", type: "text", required: true, placeholder: "12/31/2024, 12/31/2023" },
          ],
        },
        {
          id: "sign",
          title: "Almost done",
          help: "The IRS mails transcripts to your address on file in about 10 business days.",
          fields: [
            { key: "phone", label: "Phone number", type: "text" },
          ],
        },
      ]),
      outputTemplate: `FORM 4506-T — REQUEST FOR TRANSCRIPT OF TAX RETURN
==================================================

1a. Name:                {{name}}
1b. SSN:                 {{ssn}}
3.  Current address:     {{address}}
4.  Previous address:    {{previous_address}}

TRANSCRIPT REQUESTED
6/8. Type:               {{transcript_type}}
9.   Year(s) requested:  {{tax_years}}

Phone: {{phone}}

SIGNATURE
  Sign: ______________________________   Date: ____________

Faster option: transcripts are available instantly in your IRS
online account. Compare against the official IRS Form 4506-T
before submitting.`,
    },
  ];

  for (const t of templates) {
    const exists = await db.irsFormTemplate.findFirst({ where: { formNumber: t.formNumber } });
    if (!exists) await db.irsFormTemplate.create({ data: { ...t, isPublished: true } });
  }
}

async function main() {
  await seedSettings();
  await seedAdmin();
  await seedAdminRoles();
  await seedPlansAndFeatures();
  await seedGateway();
  await seedAiAndPipelines();
  await seedContent();
  await seedKnowledge();
  await seedFormTemplates();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
