# Package R — Admin ConversationIntelligence re-enrich

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages I–N (Package I enrich path; Package M diagnostics; Package N Case persist)

## Locks

1. Admin-only mutate (`admin.ai`) via `reenrichIntelligenceAction` — lookup remains read-only; no silent write on GET.
2. `reenrichEntityIntelligence` supports `situation` | `qa_thread` | `case` and reuses Package I only: `runConversationIntelligence` → `enrichIntelligenceWithReasoningModel` (+ `priorContractFromStored`).
3. Persist to that entity’s `intelligenceJson`. Situation also refreshes `learningEventJson` from the enriched learning event.
4. Fail-closed: exceptions or unparseable enrich output leave stored JSON unchanged.
5. UI: Re-enrich control on `/admin/intelligence` after a successful lookup; Case detail links there (does not replace `/admin/diagnostics`).

## Non-goals

- Mass historical Case intel backfill job _(→ Package T)_
- Experience L3/L4 corpus depth _(→ Package S)_
- Vector / embedding authority search _(→ Package U)_
- Form 433 / full financial-statement depth
- Replacing AI ops Diagnostics

## Check

```bash
npm run test:package-r
```
