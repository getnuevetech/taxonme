# Package P — Gated knowledge retrieval (Q&A / notice)

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package B/G authority gates; Case path already uses `retrieveAuthorityForCase`

## Locks

1. `retrieveKnowledge` (Q&A, notice, AI lab) routes through `retrieveKnowledgeForQuery` and applies `authoritySourceBlockedByGates` with options from `authorityGateOptsFromQuery`.
2. Thin / amount-unknown debt queries cannot retrieve installment-threshold or named FTA/AEP sources unless the user asks for that education explicitly (or amount/year is present).
3. Notice-code boost (CP/LT) remains; notice fallback KB rows are gated the same way.
4. Case analysis continues to use `retrieveAuthorityForCase` (unchanged ranking).
5. Fail closed: gated-out corpus → empty knowledge / “(no matching…)” rather than ungated leftovers.

## Non-goals

- Notice-explainer prompt/UI full rewrite
- Experience L3/L4 corpus seeding
- Vector/embedding search rewrite
- New knowledge seed content beyond gate behavior

## Check

```bash
npm run test:package-p
```
