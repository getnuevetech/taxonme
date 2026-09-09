# Package S — Experience L3/L4 Production corpus

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Wave 7 Experience Search; Package I reasoning enrichment

## Locks

1. Curated de-identified institutional patterns ship as non-stale **L4 Production** rows via `seedCuratedProductionPatterns` (stable `sourceDigest` upsert).
2. At least one L4 pattern for `identify_available_pathways` prefers `ability_to_pay` and suppresses `full_form_433_package` / `complete_financial_statement` (NEG-TAX-RELIEF-SCHEMA-001).
3. Experience Search remains L4-only + fail-closed empty; `productionPatternAskHints` → `applyExperienceAskHints` may **reorder/suppress existing** asks only — never invent new questions.
4. `prisma/seed.ts` upserts Package S patterns; Admin Pattern Registry remains the promotion authority for non-seed rows — no silent customer-traffic auto-promote to L4; no live fine-tuning.
5. Current authority still outranks Production patterns in Experience Search precedence.

## Non-goals

- Full Form 433 / complete financial-statement interview
- Vector / embedding authority rewrite _(→ Package U)_
- Mass historical Case intel backfill _(→ Package T)_
- Changing Experience Search scoring beyond corpus wiring
- Expanding KB seed content or presenter/notice honesty (Packages O/P/Q)

## Check

```bash
npm run test:package-s
```
