> **Local copy on TaxOnMe.** Playbook source of truth for ImmigrationOnMe remains `getnuevetech/myimmigration`. Wave status for this repo starts at Wave 0 (`docs/v5.1/WAVE-0-GAP-MATRIX.md`).

# TaxOnMe optimization execution plan

**Purpose:** Use the current ImmigrationOnMe (this repo) state as a **playbook** to optimize [TaxOnMe](https://github.com/getnuevetech/taxonme). ImmigrationOnMe was forked from TaxOnMe; this document describes what ImmigrationOnMe has become and the **ordered work** to bring TaxOnMe to the same engineering and product posture—translated into tax language.

**Audience:** Engineers executing TaxOnMe PRs.  
**Source of truth (ImmigrationOnMe):** `main` as of 2026-08-31 (includes Phase S, −1 / −1.7 / −1.8 / −1.9, V5.1, billing matrix, `/healthz`).  
**Related:** `docs/domain-map.md` (Tax → Immigration vocabulary). This plan is the **reverse** direction.

---

## 0. How to use this plan

1. Treat each **Wave** below as a TaxOnMe PR series with its own charter + `scripts/*-check.ts` gate (same style as ImmigrationOnMe).
2. **Port engines and contracts**, not immigration strings, forms, or fixtures.
3. Keep / restore TaxOnMe domain under `src/domain` (or equivalent). Re-apply `docs/domain-map.md` in reverse when reading ImmigrationOnMe code.
4. Do **not** reopen ImmigrationOnMe’s locked Option B architecture for TaxOnMe—**mirror** it with tax analogues (Situation → Prep Plan → Agency Matter).
5. **Binding product guide:** TaxOnMe must reason **dynamically** over unbounded IRS/tax scenarios (letters, liabilities, benefits, Q&A)—not static one-scenario answers. Read and apply `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md` on every analysis / conversation / presentation / authority change. Depth must be proportional to evidence; empty modules render nothing.

---

## 1. Current ImmigrationOnMe state (what “optimized” means)

### 1.1 Stack

| Layer | ImmigrationOnMe |
| --- | --- |
| App | Next.js 15 App Router, React 19, Server Actions, Tailwind |
| Data | Prisma + PostgreSQL; Docker Compose; migrate+seed on entrypoint |
| Auth | JWT session, roles (`super_admin` / `admin` / `user` / `consultant`), Google OAuth optional |
| Surfaces | Public `/`, guest `/start/*`, customer `/app/*`, consultant `/consultant/*`, admin `/admin/*` |
| Billing | Free / Plus / Pro (+ partner); admin-editable `PlanFeature` matrix |
| Ops | `/healthz` (LB HTTP liveness) vs `/api/health` (deep readiness + cron) |

### 1.2 Product lifecycle (locked)

```
Question → Situation → Filing Plan → Case (government matter only)
```

- **Situation** = pre-filing / options workspace (not a Case).
- **Filing Plan** = preparation sequence; never runs full Case analysis.
- **Case** = something is (or was) before a government agency.
- Workspace is **silent** (no “Do you want to open a case?”).
- Conversation **Router** chooses Pipeline A (assistant) vs Pipeline B (case engine).

Charter: `docs/v5.1/PHASE-S-SITUATION-FILING-PLAN-EXECUTION.md`.

### 1.3 Analysis integrity (V5.1 — shipped)

Sequence `0 → F → A → B → C → E → D → G`:

| Phase | What it locks |
| --- | --- |
| 0 | Correction spec / golden fixtures |
| F | Orchestration reliability + model-call ceilings |
| A | Classification + dedupe honesty |
| B | Fact ledger + provenance + invalidation |
| C | Three locks: retrieval ≠ presentation ≠ recommendation |
| E | Approval gate BLOCK/WARNING + audit |
| D | Deterministic action ranking |
| G | Multi-fixture regression pack |

Gates: `npm run test:v51`, `npm run test:evidence`.  
Index: `docs/v5.1/V5.1-DELIVERY-COMPLETE.md`.

### 1.4 Conversation before Case (−1 family — shipped)

| Phase | What it locks |
| --- | --- |
| −1 | Question Contract, intent, answerability, router A/B, Model Responsibility |
| −1.7 | Contract continuity, need-to-know clarify, guide routing |
| −1.8 | Pipeline A UX (structured answers, focus, promote, starters) |
| −1.9 L0–L7 + S8 | Experience capture → de-ID → candidates → admin promotion → L4-only search → telemetry; fixtures |

Gates: `npm run test:phase-minus1`, `npm run test:phase-minus1-9`.

### 1.5 Commercial + ops (recent)

| Item | ImmigrationOnMe |
| --- | --- |
| Billing matrix | Free: explore only; Plus: capped Filing Plan / form wizards / downloads; Pro: unlimited + professional referral. Admin-editable limits. `docs/v5.1/PHASE-BILLING-TIER-MATRIX.md` |
| Prod harden | Dashboard Situation query isolated; `/api/health` reports `schemaReady` |
| Lightsail LB | `GET /healthz` HTTP plain `ok`; Caddy example keeps `/healthz` off HTTPS redirect |
| Guest continuity | Guest session → claim on register/login; safe `next` resume |
| CTA emphasis | Monetization footers bold-teal account + professional offers (PR #150 if not yet on `main`) |

### 1.6 Regression culture

Every charter has a `scripts/<phase>-*-check.ts` and an npm script; umbrella gates compose them (`test:phase-s`, `test:v51`). **Port this habit** to TaxOnMe even when content differs.

---

## 2. Concept map (Immigration → Tax)

Use when reading ImmigrationOnMe code and writing TaxOnMe charters.

| ImmigrationOnMe | TaxOnMe target |
| --- | --- |
| USCIS / EOIR / DOS / ICE-CBP | IRS / state DOR / Tax Court / Collections |
| Applicant / petitioner / beneficiary | Taxpayer / spouse / dependent / responsible party |
| Immigration attorney / accredited rep | CPA / EA / tax attorney / enrolled agent |
| Situation (SIT-) | Tax **Situation** (open question / pre-filing / unresolved issue) |
| Filing Plan | **Prep / filing plan** (return or response packet sequence) |
| Case (IMM- / government matter) | **Agency matter** (notice, audit, levy, exam, filed return under review) |
| Pipeline A | Tax Q&A / notice explain without opening a matter |
| Pipeline B / V5.1 engine | Full matter analysis (ledger, locks, gate, presentation) |
| USCIS notice / RFE / NOID | IRS/state notice (CP/LT, audit, levy, lien) |
| Receipt / I-797 / case status | Transcript / acknowledgment / e-file conf / notice ID |
| Form wizard (I-130…) | Tax form / installment / response wizard |
| Response letter | Letter to IRS/state |
| USCIS knowledge base | Pubs / IRM / code / state instructions (admin-curated) |
| Pro consultant referral | Tax-pro referral (mutual consent) |
| Experience L4 pattern | De-identified tax outcome/correction pattern (still below current authority) |
| Free / Plus / Pro shape | Same commercial shape; gate prep-plan build + form wizards/downloads |

Evidence engines stay generic (`facts`, `events`, `unknowns`, `reconstruction`). Domain classifiers, fact keys, prompts, and copy stay in TaxOnMe `src/domain`.

---

## 3. Product locks TaxOnMe must adopt (domain-neutral)

Copy these as TaxOnMe charter invariants (tax wording):

1. **Problem ≠ Agency matter** — Q&A alone does not create a Case/Matter.
2. **Lifecycle:** Question → Situation → Prep Plan → Agency Matter (existing notice may jump earlier).
3. **Silent workspace** — never ask “Open a case?”; route from ask + matter signals.
4. **Schema completeness must not promote** Situation → Matter.
5. **Workspace ≠ analysis depth** — “What does this CP2000 mean?” can be Pipeline A.
6. **Router is sole pipeline authority** — interpreter recommends; router decides A vs B.
7. **Upload alone ≠ Matter** — document + requested action decide.
8. **Need-to-know clarify** — only `critical_now` + `changes_branch`.
9. **Three locks** — retrieval ≠ presentation ≠ recommendation.
10. **Approval gate** — BLOCK/WARNING before customer presentation; audited overrides.
11. **Authority precedence** — current authority > reviewed rule > validated production pattern > historical experience > model inference.
12. **Outcome ≠ law**; **no live fine-tuning** from production traffic.
13. **Models return JSON; UI owns presentation.**
14. **Admin-configurability** — plans, features, providers, pipelines, content in DB.

---

## 4. Execution waves for TaxOnMe

Execute in order. Each wave: charter doc → implement → `scripts/*-check.ts` → merge.

### Wave 0 — Baseline audit & domain hygiene

**Goal:** Know drift from ImmigrationOnMe; kill residual immigration language in TaxOnMe if any fork leftovers exist; confirm TaxOnMe `domain-map` / `src/domain` ownership.

**Do:**

- Diff TaxOnMe vs ImmigrationOnMe on: `src/lib/access.ts`, guest/auth-continue, health routes, conversation/, experience/, phase check scripts, Docker entrypoint.
- Inventory TaxOnMe plans/features vs Free/Plus/Pro matrix.
- Confirm customer copy uses IRS/tax language only (reverse of ImmigrationOnMe rule: no USCIS/I-130 leakage).

**Exit:** Written gap list mapped to Waves 1–7.

---

### Wave 1 — Ops parity (fast, high leverage)

**Goal:** Match ImmigrationOnMe deploy/ops reliability.

| Deliverable | Port from (ImmigrationOnMe) |
| --- | --- |
| `GET /healthz` plain HTTP 200 `ok` (no DB) | `src/app/healthz/route.ts` |
| `GET /api/health` deep readiness + optional cron maintenance | `src/app/api/health/route.ts` |
| Caddy/Lightsail notes: LB = HTTP `/healthz` on :80 or :3000 | `DEPLOYMENT.md`, `deploy/Caddyfile.example` |
| Harden dashboards so missing tables don’t white-screen | `src/app/app/page.tsx` Situation `.catch` pattern |

**Check:** `test:lightsail-healthz` analogue.  
**Host:** Point Lightsail LB at `/healthz` over HTTP (not HTTPS).

---

### Wave 2 — Guest continuity + conversion UX

**Goal:** Guests can explore → register/login → resume the same thread/situation/matter.

| Deliverable | Port from |
| --- | --- |
| Guest session cookie + claim on auth | `src/lib/guest.ts`, `src/actions/auth.ts` |
| Safe `next` / claimed resume | `src/lib/auth-continue.ts` |
| Guest `/start/*` surfaces | `src/app/start/` |
| Monetization footers + CTAs (register / upgrade / tax-pro) | `src/lib/qa-access.ts`, `src/components/qa-chat.tsx` |
| Bold emphasis on account + professional offers | `src/components/assistant-reply.tsx` (`**…**` → teal strong) |

**Check:** `guest-continuity-check` analogue; assert register CTA paths.

**TaxOnMe note:** If TaxOnMe adds first-class Situations, extend `claimGuestSession` to claim them (ImmigrationOnMe still primarily claims Case / Document / QaThread).

---

### Wave 3 — Billing Free / Plus / Pro matrix

**Goal:** Plus is not the unlimited toolkit; Free explores; Pro unlimited + professional referral.

| Deliverable | Port from |
| --- | --- |
| Feature keys + `hasFeature` / `featureLimit` | `src/lib/constants.ts`, `src/lib/access.ts` |
| Monthly quotas helper | `src/lib/billing-quotas.ts` |
| Seed corrective matrix (admin can still edit) | `prisma/seed.ts` |
| Gate: prep-plan build, form wizard start, download | Filing Plan / forms actions |
| Public plan descriptions | `src/lib/goal-public.ts` |
| Charter | Mirror `PHASE-BILLING-TIER-MATRIX.md` with tax feature keys |

**Suggested Tax defaults (adjust in admin):**

| Plan | Prep plan build | Form wizards | Downloads |
| --- | --- | --- | --- |
| Free | No | No | No |
| Plus | Cap (e.g. 2/mo) | Cap (e.g. 2/mo) | Cap (e.g. 1/mo) |
| Pro | Unlimited | Unlimited | Unlimited + tax-pro referral |

**Check:** `test:phase-billing` analogue.

---

### Wave 4 — Conversation Intelligence (−1 / −1.7 / −1.8)

**Goal:** Assistant answers tax questions without forcing a matter; router blocks premature Case/Matter engine.

| Deliverable | Port from |
| --- | --- |
| Question Contract, intent, answerability, need-to-know | `src/lib/conversation/*` |
| Conversation router (Pipeline A vs B) | `conversation-router.ts` |
| Model Responsibility (brain vs doc roles) | Phase −1 model-responsibility check |
| Guide widget routing / continuity | Phase −1.7 |
| Pipeline A UX (structured reply, focus, starters) | Phase −1.8, `assistant-composer`, `qa-chat` |

**Tax reinterpret:** `government-matter.ts` → IRS/state matter signals (notice types, audit, levy)—new classifiers, same router contract.

**Check:** `test:phase-minus1` analogue.

---

### Wave 5 — Situation → Prep Plan → Agency Matter (Phase S analogue)

**Goal:** First-class workspaces; stop using “Case” for every tax chat.

| Deliverable | TaxOnMe name | Port pattern from |
| --- | --- | --- |
| Situation model + list/nav/dashboard | Tax Situation | `Situation`, `/app/situations`, discovery check |
| Prep / Filing Plan from Situation (no Case engine) | Prep Plan | `FilingPlan`, `createFilingPlanAction`, S3 |
| Case/Matter only for agency contact | Agency Matter | Phase S4 lifecycle + reclassify CLI |
| Customer copy cleanup | — | Phase S5 (no forceCase; Situation language) |
| Consolidated regression | — | Phase S6 |

**Check:** `test:phase-s` analogue (router + workspace + discovery + copy).

---

### Wave 6 — Matter engine integrity (V5.1 analogue)

**Goal:** When Pipeline B runs, TaxOnMe has the same integrity stack.

Order (same as ImmigrationOnMe): **F → A → B → C → E → D → G** (after a frozen Phase 0 correction spec).

| Phase | Port engines from | Tax work |
| --- | --- | --- |
| 0 | Correction spec pattern | Golden tax fixtures (e.g. CP2000, levy, 1040 + W-2 mismatch)—**new content** |
| F | Orchestration ceilings | Same ceilings, tax pipelines |
| A | Classification / dedupe | Tax document kinds |
| B | Fact ledger | Tax fact keys (`tax_year`, balances, notice deadlines—see `domain-map.md`) |
| C | Three locks | Same |
| E | Approval gate | Same rules shape; tax BLOCK reasons |
| D | Action ranking | Tax next actions |
| G | Fixture pack | Tax pos/neg isolation |

**Check:** `test:v51` analogue + `test:evidence`.

---

### Wave 7 — Experience / institutional learning (−1.9)

**Goal:** Capture → de-ID → admin promotion → L4-only retrieval → telemetry; **no live fine-tuning**.

Port `src/lib/experience/*` + admin Pattern Registry UI; replace immigration outcome types with tax outcomes (assessment, abatement, installment agreement, etc.).

**Check:** `test:phase-minus1-9` analogue + fixture pack (S8).

---

### Post–Wave 7 — Evidence-proportional dynamic intelligence

Waves 0–7 port the Imm engineering posture. Remaining product risk is **scenario-static fallbacks** that invent goals, fake conflicts, fill modules without evidence, and premature resolution paths.

**North star:** help users navigate *any* IRS problem — understand letters/issues, benefits and liabilities — by reasoning with online/IRS authority, not canned playbooks. See `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`.

| Package | Focus | Intent |
| --- | --- | --- |
| **A** | Goal provenance; fact-based consensus; omit unsupported modules | Honesty under uncertainty (generalizes to all thin intakes). Charter: `docs/v5.1/PACKAGE-A-EVIDENCE-PROPORTIONAL.md`. Gate: `npm run test:package-a`. |
| **B** | Dynamic next ask; evidence-gap docs; authority timing/freshness | Next step + rules adapt to *this* matter |
| **C** | Approved-analysis path; real completion states; readiness; paywall safety | Actions and gating stay trustworthy across scenarios |

These packages **increase** dynamic capability by retiring static templates; they do not narrow TaxOnMe to one demo case.

---

## 5. Suggested TaxOnMe PR checklist (per wave)

- [ ] Charter under `docs/` (purpose, locks, non-goals, check command)
- [ ] Aligns with `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md` (no new scenario-static playbooks)
- [ ] Implementation with domain strings only in `src/domain` / tax copy modules
- [ ] `scripts/<wave>-check.ts` + npm script; wire into umbrella gate
- [ ] Seed/migrate if schema changes; Docker entrypoint still migrates
- [ ] Admin can configure what customers shouldn’t need a deploy to change (plans, prompts, knowledge)
- [ ] Deploy notes (migrate, seed, healthz LB path)

---

## 6. Source index (ImmigrationOnMe paths to read while implementing)

| Concern | Paths |
| --- | --- |
| Domain map | `docs/domain-map.md` |
| Dynamic IRS reasoning (binding) | `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md` |
| Phase S program | `docs/v5.1/PHASE-S-SITUATION-FILING-PLAN-EXECUTION.md` |
| Billing | `docs/v5.1/PHASE-BILLING-TIER-MATRIX.md`, `src/lib/billing-quotas.ts`, `prisma/seed.ts` |
| Conversation | `docs/v5.1/PHASE-MINUS1-*.md`, `src/lib/conversation/` |
| Experience | `docs/v5.1/PHASE-MINUS1-9-*.md`, `src/lib/experience/` |
| V5.1 | `docs/v5.1/PHASE-{F,A,B,C,E,D,G}-*.md`, `V5.1-CORRECTION-SPEC.md` |
| Guest | `src/lib/guest.ts`, `src/lib/auth-continue.ts`, `scripts/guest-continuity-check.ts` |
| Health | `src/app/healthz/route.ts`, `src/app/api/health/route.ts`, `DEPLOYMENT.md` |
| Gates | `package.json` scripts `test:phase-*`, `test:v51`, `test:evidence` |
| CTA emphasis | `src/components/assistant-reply.tsx`, `src/lib/qa-access.ts` |

---

## 7. Explicitly do **not** copy into TaxOnMe

- USCIS/EOIR form numbers, notice types, VAWA/golden immigration fixtures
- `UscisFormTemplate` content and USCIS PDF maps
- Immigration consultant specialties / “not a law firm / not USCIS” disclaimers (rewrite for tax)
- Immigration public hero/FAQ/uscis-updates surfaces
- Prompt bodies that name immigration forms—**keep JSON shapes**, rewrite examples
- Any assumption that “Case” = every logged-in workspace

---

## 8. Success definition for TaxOnMe

TaxOnMe is “optimized like ImmigrationOnMe” when:

1. Guests can explore and resume after signup without losing work.
2. Free / Plus / Pro are enforced in code **and** editable in admin; Plus is capped.
3. Q&A/Situation/Prep Plan/Agency Matter are separate workspaces with silent routing.
4. Full matter analysis only runs when the router selects Pipeline B; integrity stack (ledger, locks, gate, ranking) is gated by scripts.
5. Experience learning is de-identified, admin-promoted, L4-only in retrieval, with telemetry—and never live fine-tunes.
6. Lightsail (or any LB) health-checks **HTTP `/healthz`** successfully.
7. Every wave has a failing-closed check script on `main`.
8. The product handles **open-ended** IRS/tax questions and matters dynamically (authority-grounded, evidence-proportional)—not a fixed set of static scenario responses (`DYNAMIC-IRS-REASONING-GUIDE.md`).

---

## 9. Recommended start order (if staffing is limited)

1. **Wave 1** (healthz) + **Wave 3** (billing caps) — immediate ops/commercial value  
2. **Wave 2** (guest continuity)  
3. **Wave 4** (conversation router)  
4. **Wave 5** (Situation / Prep Plan / Matter split)  
5. **Wave 6** then **Wave 7** — deepest integrity + learning  

---

*Maintained from ImmigrationOnMe. When ImmigrationOnMe ships a new phase charter, append a row to §1 and a corresponding TaxOnMe wave note rather than rewriting history.*
