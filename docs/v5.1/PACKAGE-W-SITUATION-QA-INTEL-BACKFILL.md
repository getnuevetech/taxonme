# Package W — Situation / QaThread empty-intelligence backfill

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages I, R, T (Package I enrich; R re-enrich; T Case empty-only pattern)

## Locks

1. **Empty-only:** backfill Situations and QaThreads where `!parseStoredIntelligence(intelligenceJson)`. Never overwrite a parseable snapshot.
2. **Reuse Package R only:** each write calls `reenrichEntityIntelligence({ kind: "situation" | "qa_thread", id })`.
3. **Fail-closed per entity:** enrich/parse failure leaves stored JSON unchanged; batch continues and counts `written` / `skipped` / `failed`.
4. **Admin-only / explicit invoke:** `admin.ai` via `backfillSituationQaIntelligenceAction` (dry-run + apply) and CLI `scripts/situation-qa-intelligence-backfill.ts`. No silent cron on GET.
5. **Forward fix:** Pipeline A intake QaThread create persists `intelligenceJson` (same intel already computed for the assistant reply).
6. Case empty backfill remains Package T (`backfillEmptyCaseIntelligence`).

## Non-goals

- Force re-enrich of non-empty `intelligenceJson`
- Form 433 / complete financial-statement interview
- Broad KB seed / embedding corpus growth
- Experience Search vector rewrite / pgvector
- Rewriting Case empty backfill (Package T)

## Check

```bash
npm run test:package-w
```
