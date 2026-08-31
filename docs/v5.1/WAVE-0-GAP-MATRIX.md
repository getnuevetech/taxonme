# Wave 0 — Baseline audit & domain hygiene

**Status:** Shipped (docs)  
**Date:** 2026-08-31  
**Playbook:** ImmigrationOnMe (`getnuevetech/myimmigration`) as of 2026-08-31  
**Target:** This repo — TaxOnMe (`getnuevetech/taxonme`)

## Purpose

Lock the gap between current TaxOnMe and the ImmigrationOnMe “optimized” posture
before any engine ports. Port **engines and contracts**, not immigration strings.

## Product locks (domain-neutral — adopt in later waves)

1. Problem ≠ Agency matter — Q&A alone does not create a Case/Matter.
2. Lifecycle: Question → Situation → Prep Plan → Agency Matter.
3. Silent workspace — never ask “Open a case?”; route from ask + matter signals.
4. Schema completeness must not promote Situation → Matter.
5. Workspace ≠ analysis depth — notice explain can stay Pipeline A.
6. Router is sole pipeline authority (A vs B).
7. Upload alone ≠ Matter.
8. Need-to-know clarify only.
9. Three locks — retrieval ≠ presentation ≠ recommendation.
10. Approval gate BLOCK/WARNING + audit.
11. Authority precedence — current authority > reviewed rule > validated pattern > historical experience > model inference.
12. Outcome ≠ law; no live fine-tuning from production traffic.
13. Models return JSON; UI owns presentation.
14. Admin-configurability for plans, features, providers, pipelines, content.

## Gap matrix (TaxOnMe → Imm path → wave)

| Concern | TaxOnMe today | Imm playbook path | Wave |
| --- | --- | --- | --- |
| Liveness LB probe | Missing `/healthz`; `/api/health` is DB-only | `src/app/healthz/route.ts`, deep `api/health` | 1 |
| Deploy / Caddy Lightsail | Basic Caddy snippet; no `/healthz` exemption | `deploy/Caddyfile.example`, `DEPLOYMENT.md` | 1 |
| Dashboard harden | Parallel queries can white-screen | Situation `.catch` isolation on `/app` | 1 (prep), 5 |
| Guest claim | `guest.ts` claims Case/Doc/QA | Same + Situations later | 2, 5 |
| Safe `next` resume | Always redirects `/app` after auth | `auth-continue.ts` | 2 |
| QA monetization CTAs | Minimal | `qa-access.ts`, assistant emphasis | 2 |
| Billing matrix | Plus ≈ unlimited forms; report capped | `billing-quotas.ts`, `filing_plan.build` caps | 3a forms, 3b prep-plan |
| Seed corrective upserts | Most plan features `update: {}` | Corrective enabled+limit upserts | 3 |
| Conversation router | None; guide offers “new case?” | `src/lib/conversation/*` | 4 |
| Situation / Prep Plan | Case field + AI stage only | `situation.ts`, `filing-plan.ts`, `/app/situations` | 5 |
| V5.1 integrity | v3.2 evidence / letter-guard | `approval-gate*`, locks, ranking, fixture pack | 6 |
| Experience L0–L7 | Consultant “experience” page only | `src/lib/experience/*` | 7 |
| Domain ownership | No `src/domain`; tax in lib/copy | Imm `src/domain` + this map | 0–7 |
| Regression culture | `npm test`, `v32:*`, `irs:updates-check` | `test:phase-*`, `test:v51` | every wave |
| Next.js | 16.3 | Imm on 15.5 — **do not downgrade** | n/a |

## Explicitly do not copy from Imm

- USCIS/EOIR form numbers, VAWA/golden immigration fixtures
- `UscisFormTemplate` content / USCIS PDF maps
- Immigration consultant specialties / “not a law firm / not USCIS” disclaimers (rewrite for tax)
- Immigration public hero/FAQ/uscis-updates surfaces
- Prompt bodies that name immigration forms — keep JSON shapes, rewrite examples
- Assumption that “Case” = every logged-in workspace

## Exit

- [x] Domain map in-repo (`docs/domain-map.md`)
- [x] Optimization execution plan in-repo (`docs/TAXONME-OPTIMIZATION-EXECUTION-PLAN.md`)
- [x] This gap matrix mapped to Waves 1–7
- [ ] Product behavior unchanged (Wave 0 only)

## Next

Wave 1 — Ops parity (`/healthz`, deep `/api/health`, Caddy/Lightsail notes, dashboard harden prep).
