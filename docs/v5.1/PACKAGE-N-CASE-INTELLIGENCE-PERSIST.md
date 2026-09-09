# Package N — Case ConversationIntelligence persistence

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages I–M (enriched intel at Case create; admin diagnostics)

## Locks

1. `Case.intelligenceJson` (`String @default("{}")`) stores the ConversationIntelligence snapshot used at Case create (mirror Situation / QaThread).
2. `startIntakeAction` and `createCaseAction` persist `JSON.stringify(intel)` on every Case create that runs the case engine path.
3. Read precedence: parseable `Case.intelligenceJson` → `originSituation.intelligenceJson` → narrative recompute (`resolveCaseIntelligenceJson` / `intelligenceForCase` / `summarizeForCase`).
4. Clarify (`nextClarifyQuestion`), answer-first panel, admin Case panel, and `/admin/intelligence` Case lookup use that precedence.
5. When reclassify links a Situation to a Case with empty/unparseable Case intel, copy Situation snapshot once — never clobber a Case snapshot.

## Non-goals

- Admin mutate / re-run enrichment _(→ Package R)_
- Presenter prompt rewrite (Package L deferred)
- Forced backfill of historical Cases (empty → recompute until next write)

## Check

```bash
npm run test:package-n
```
