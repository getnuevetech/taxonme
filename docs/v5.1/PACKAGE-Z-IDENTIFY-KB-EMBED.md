# Package Z — Identify-only KB expansion + embed backfill

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages Y (seed honesty + playbook gates), U (hybrid + embed CLI), P/B/G gates

## Locks

1. Add a small set of **identify-only** knowledge seeds: **CP503**, **CP504**, **Wage & Income transcript**, **Identifying an IRS notice** — what the notice/record is, deadlines/rights, next evidence ask — no installment / CNC / OIC / 9465 / `$50k` menus.
2. Upsert via Package G/Y seed path; content changes clear embeddings so stale vectors cannot re-rank old prose.
3. Thin fixture retrieval remains playbook-free under Package Y gates; CP503/CP504 / wage-income / notice-identity queries surface identify/evidence copy.
4. Hybrid retrieval unchanged (Package U): keyword + cosine when vectors exist; fail closed to keyword/empty. Explicit embed via `npm run backfill:knowledge-embed` (no silent cron).
5. Charter + `npm run test:package-z` + CI; guide row **Z**.

## Non-goals

- Mass corpus dump / Experience Search rewrite
- Form 433 / financial-statement interview
- FAQ ContentPage / Form 9465 wizard tip / guide STEP_TIPS
- Weakening V/O/Q presenters; replacing U hybrid scoring / pgvector
- Force intel re-enrich (Package X)
- Rewriting Y playbook gates

## Check

```bash
npm run test:package-z
```
