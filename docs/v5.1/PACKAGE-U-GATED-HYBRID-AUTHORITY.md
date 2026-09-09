# Package U — Gated hybrid authority retrieval (embedding slice)

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages B/G/P authority gates; admin AiProvider (openai_compatible)

## Locks

1. `KnowledgeSource` stores `embeddingJson` / `embeddingModel` / `embeddedAt` (JSON float vector; empty = keyword-only).
2. Shared hybrid score for Case + Q&A/notice: keyword/notice-code + cosine when both query and source embeddings exist (`hybridAuthorityScore`).
3. Package P/B/G gates still filter every candidate (`authoritySourceBlockedByGates` / `authorityGateOptsFromQuery`) — thin debt cannot surface installment thresholds or named FTA/AEP unless education/amount/year facts allow.
4. Fail closed: missing provider, embed API failure, or empty vectors → keyword-only or empty retrieval — never ungated leftovers.
5. Explicit embed path: best-effort re-embed on admin knowledge save; CLI `scripts/knowledge-embed-backfill.ts` (dry-run / apply). No silent cron on GET.
6. Embedding calls use enabled `openai_compatible` `AiProvider` + `EMBEDDING_MODEL` (default `text-embedding-3-small`).

## Non-goals

- Full Form 433 / complete financial-statement interview
- Experience Search vector rewrite
- LLM re-ranker / chunking overhaul / full RAG rewrite
- pgvector / external vector DB
- Broad new KB seed corpus _(→ after Package Y seed honesty)_
- Force re-enrich of non-empty Case intel _(→ Package X)_

## Check

```bash
npm run test:package-u
```
