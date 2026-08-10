# TaxOnMe — MyTaxOnMe.com

A friendly AI tax assistant that helps people understand IRS notices, tax documents, refunds, and tax debt in plain English — and turns every situation into a simple, step-by-step plan. TaxOnMe is **not** the IRS, a CPA firm, or a law firm; it is a guidance tool with optional referral to vetted CPA/EA consultants.

## What's in V1

| Feature | Status |
| --- | --- |
| Upload / photograph IRS notices | ✅ |
| Identify notice type, tax year, amount, deadline | ✅ |
| Plain-English explanations + personalized next steps | ✅ |
| AI tax Q&A (guest-friendly) | ✅ |
| Upload & explain W-2 / 1099 / 1040 / transcripts | ✅ |
| Response-letter generator (user reviews & mails) | ✅ |
| Deadline reminders | ✅ |
| Private document vault (user-deletable) | ✅ |
| CPA/EA referral with mutual-consent connection | ✅ |
| Simplified "video-game" IRS form wizards → regenerated standard forms | ✅ |
| Subscriptions with admin-controlled feature access | ✅ |
| E-file / send responses to IRS / negotiate with IRS | ❌ (later) |

## Architecture

Six layers, exactly as designed:

1. **Customer input** — situation + goal + documents. Works without an account; a guest session stores everything and attaches it to the user's account on registration.
2. **Document intelligence** — two independent AI extractors (e.g. Claude + Gemini) map each document into the standardized TaxOnMe schema.
3. **Fact normalization** — parsed model outputs merged field-by-field.
4. **Tax intelligence** — analysis grounded in an admin-curated **IRS knowledge base** (publications, notice guides, transcript transaction codes, payment-plan and penalty-abatement rules), answered as structured questions (issue, evidence, IRS basis, conditions, confidence, professional review).
5. **Verification** — a deterministic consensus engine: agreement merges, disagreement is flagged **"verification required"** (never guessed). Case readiness (0–100%) is computed by our own formula: documents + verified facts + IRS source confirmation − contradictions.
6. **TaxOnMe UI** — models return JSON only; the frontend renders cards, amounts, product states (✓ Resolved, ◐ Review, ! Action Needed, ▲ Urgent, ? Information Needed), timelines, and progress deterministically. The AI never writes the customer's screen.

If no AI provider is configured yet, the platform runs in a labeled deterministic fallback mode so the product remains usable end-to-end.

### Nothing is hardcoded

Every business variable is managed from the admin backend (`/admin`):

- **AI providers** — add 3–5 providers (OpenAI-compatible, Anthropic, Google) with base URL, API key, model, tokens, temperature.
- **AI pipelines** — per stage (summary, goal, document, situation, presenter, Q&A, notice, letter), pick which providers run, in which role (fact extractor / interpreter / skeptic / extractor A+B / analyst / reviewer / presenter), with fully editable prompt templates.
- **Plans & access control** — plan CRUD plus a feature/limit matrix gating every app capability by subscription level.
- **Payment gateways** — pluggable gateway configs (Stripe, PayPal, manual/dev) stored as JSON config; no vendor keys in code.
- **Content & agreements** — terms, privacy, policy, legal, blog, and the three versioned agreements (user, consultant, user↔consultant connection) with acceptance tracking.
- **IRS form templates** — wizard steps (JSON) + output templates that regenerate the standard form layout.
- **IRS knowledge base** — the authoritative material AI analysis cites.
- **App settings** — branding, hero copy, disclaimer, OAuth keys, URLs, analysis parameters, consultant auto-approval rules.
- **Admin roles** — the super admin can create sub-admins scoped to specific admin areas.

### User types

- **Admin** — super admin + granular sub-admin roles.
- **Regular users** — guest-first onboarding; registration (email compulsory; Google OAuth optional) with agreement checkbox; basic profile (name, address, phone, optional ID, bio, avatar); can delete files and their entire profile at will.
- **CPA/Tax consultants** — IRS-standard onboarding (CPA/EA/consultant credential, license number, PTIN, proof upload, business vs. individual, EIN, specialties, states served). Manual admin approval with optional auto-approval rules. Client assignments require **both** the user's and the consultant's explicit consent before anything is shared.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Prisma + PostgreSQL · JWT sessions (jose) · bcryptjs.

## Getting started (development)

Requires Node.js 20+ and a PostgreSQL database (`createdb taxonme`).

```bash
npm install
cp .env.example .env        # point DATABASE_URL at your PostgreSQL instance
npx prisma migrate deploy   # create the schema
npm run db:seed             # seed settings, plans, pipelines, content, forms, knowledge
npm run dev
```

## Deploying to a local server

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** — one-command Docker Compose stack (app + PostgreSQL + persistent volumes), or a bare-metal script (`sudo bash scripts/deploy-local.sh`) that installs PostgreSQL, migrates, seeds, builds, and sets up a systemd service.

- App: http://localhost:3000
- Admin: http://localhost:3000/admin — seeded super admin: `admin@mytaxonme.com` / `ChangeMe!2026` (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; change immediately).

To enable real AI analysis, sign in as admin → **AI providers** → paste API keys for the seeded provider slots (or add your own), then review **AI pipelines**.
