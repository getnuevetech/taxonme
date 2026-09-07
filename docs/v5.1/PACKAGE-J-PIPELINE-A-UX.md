# Package J — Pipeline A UX polish (−1.8 + minimal −1.7)

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Wave 4 core; Package I enrichment

## Locks

1. Q&A has clickable `STARTER_PROMPTS`, optional `defaultQuestion` (`/app/qa?q=`), and **Working on** focus chrome from stored intelligence.
2. Promote CTAs after an assistant reply: Continue with my situation / Track this government case (never upload-alone promotion).
3. `QaThread.intelligenceJson` persists ConversationIntelligence; `askQuestionAction` uses `priorContractFromStored` for continuity.
4. Shared `AssistantReplyBlocks` render structured Pipeline A sections; Situation workspace and Case answer-first panel use them.
5. Guide hands question-shaped asks to `/app/qa?q=…`.

## Non-goals

- Full Case clarify → need-to-know planner rewrite
- Admin intelligence diagnostics panel
- Pathway honesty / enrichment changes (Packages H / I)

## Check

```bash
npm run test:package-j
```
