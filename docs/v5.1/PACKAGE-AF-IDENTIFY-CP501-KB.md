# Package AF — Identify-only mid-collection KB (CP501 + ladder)

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages Y/Z (identify-only seeds + playbook gates); U (hybrid + embed). Does not reopen Form 433 or FAQ tips.

## Locks

1. Add **identify-only** knowledge seeds: **CP501** and **Collection notice ladder — identify the stage** (CP14 → CP501 → CP503 → CP504 → LT11) — what the notice/stage is, next evidence ask — no installment / CNC / OIC / 9465 / `$50k` menus.
2. Refresh **Identifying an IRS notice** examples to include **CP501**.
3. Upsert via Package G/Y seed path; content changes clear embeddings so stale vectors cannot re-rank old prose.
4. Thin fixture retrieval remains playbook-free under Package Y gates; CP501 / ladder queries surface identify/evidence copy.
5. Charter + `npm run test:package-af` + CI; guide row **AF**.

## Non-goals

- Mass corpus dump / Experience Search rewrite
- Form 433 / financial-statement interview
- Weakening Y playbook gates or V/O/Q presenters
- FAQ / Form 9465 tip / intake chips (AA–AE)
- Force intel re-enrich; replacing U hybrid scoring

## Check

```bash
npm run test:package-af
```
