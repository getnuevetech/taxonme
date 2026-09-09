# Package X — Force overwrite ConversationIntelligence re-enrich

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages I, R, T, W (Package I enrich; R single-entity re-enrich; T/W empty-only)

## Locks

1. **Parseable-only:** force batch targets entities where `parseStoredIntelligence(intelligenceJson)` is truthy. Empty/unparseable rows are skipped (use T/W).
2. **Reuse Package R only:** each write calls `reenrichEntityIntelligence` — no parallel enrich path.
3. **Explicit force:** apply requires `force=true` / `--force` / admin overwrite acknowledgment. Dry-run may scan without force. Never on GET.
4. **Fail-closed per entity:** enrich/parse failure leaves stored JSON unchanged; batch counts `written` / `skipped` / `failed`.
5. **Admin + CLI:** `admin.ai` via `forceReenrichIntelligenceAction`; CLI `scripts/intelligence-force-reenrich.ts`. Bounded `limit` / `cursor` / optional id.
6. T/W empty-only semantics unchanged.

## Non-goals

- Form 433 / complete financial-statement interview
- Broad KB seed / embedding corpus growth
- Rewriting T/W empty-only backfill
- Experience Search vector rewrite / pgvector

## Check

```bash
npm run test:package-x
```
