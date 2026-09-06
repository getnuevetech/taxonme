# Package G — Knowledge freshness (FTA / AEP / installment re-seed)

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package B (authority timing gates)

## Locks

1. FTA knowledge row is stamped `taxYear = 2024`; AEP `taxYear = 2025`.
2. Installment knowledge keeps `requires_known_balance` tag and $50k/$100k wording for gated retrieval.
3. `seedKnowledge` **create-or-updates** by title — re-seed refreshes stale rows (not create-if-missing only).
4. Period-sensitive definitions live in `src/lib/knowledge-authority-seed.ts` (shared by seed + gate).
5. `authoritySourceBlockedByGates` still blocks year-mismatched FTA/AEP sources.

## Deploy

Run `npx prisma db seed` (or container boot seed) so existing installs pick up stamps.

## Check

```bash
npm run test:package-g
```
