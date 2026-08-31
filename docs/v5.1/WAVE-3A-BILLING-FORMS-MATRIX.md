# Wave 3a — Free / Plus / Pro forms matrix

**Status:** Shipped (forms/download caps)  
**Date:** 2026-08-31  
**Scope:** Plan gates for IRS form wizards/downloads so Plus is not the unlimited toolkit. Prep Plan key is seeded for Wave 3b/5.

## Product rule

| Plan | Explore / Q&A | Prep Plan build (`prep_plan.build`) | Form wizards (`forms.wizard`) | Form downloads (`forms.download`) |
|------|---------------|-------------------------------------|-------------------------------|-----------------------------------|
| **Free** | Yes (existing Free caps) | No (seeded; gated in Wave 5) | No | No |
| **Plus** | Yes | **2 / calendar month** (Wave 5) | **2 / calendar month** | **1 / calendar month** |
| **Pro** | Yes | Unlimited (Wave 5) | Unlimited | Unlimited (+ CPA/EA referral) |

## Implementation

- Feature key: `FEATURE_KEYS.PREP_PLAN_BUILD` → `prep_plan.build` (seeded now; action gate in Wave 5)
- Quotas: `src/lib/billing-quotas.ts` (UTC calendar month)
- Gates: `startFormAction`, `/api/forms/[id]/download`
- Seed corrective matrix in `prisma/seed.ts` (upserts `enabled` + `limitValue` on re-seed)
- Public copy: `PUBLIC_PLAN_DESCRIPTIONS` in `src/lib/plan-public.ts`

## Check

```bash
npm run test:phase-billing
```
