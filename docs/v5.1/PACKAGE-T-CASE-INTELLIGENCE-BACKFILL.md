# Package T — Historical Case intelligence backfill

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages I, N, R (Package I enrich; N Case persist; R single-entity re-enrich)

## Locks

1. **Empty-only:** backfill Cases where `!parseStoredIntelligence(intelligenceJson)` (`"{}"` / unparseable). Never overwrite a parseable snapshot.
2. **Reuse Package R only:** each write calls `reenrichEntityIntelligence({ kind: "case", id })` — no parallel enrich path.
3. **Fail-closed per entity:** enrich/parse failure leaves stored JSON unchanged; batch continues and counts `written` / `skipped` / `failed`.
4. **Admin-only / explicit invoke:** `admin.ai` via `backfillCaseIntelligenceAction` (dry-run + apply) and CLI `scripts/case-intelligence-backfill.ts`. No silent cron on GET.
5. **Bounded batch:** `limit` (1–500) + optional `cursor` / `caseId`; summary via `formatBackfillSummary`.
6. Read precedence unchanged (Case → Situation → recompute); backfill only materializes empty Case snapshots.

## Non-goals

- Force re-enrich of non-empty `intelligenceJson` _(→ Package X)_
- Vector / embedding authority rewrite _(→ Package U)_
- Form 433 / complete financial-statement interview
- Mass Situation / QaThread backfill _(→ Package W)_
- Replacing AI ops Diagnostics

## Check

```bash
npm run test:package-t
```
