# Package L — AI-path transcript deepen

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package F (`deepenedBalanceDueFinding`); Package E proportional UI

## Locks

1. When Account Transcript text establishes `accountBalance`, speculative / thin `balance_due` issues from the **AI presenter** are replaced via `applyTranscriptDeepening` — not only inside `fallbackAnalyze`.
2. `runCaseAnalysis` (orchestrator) applies deepen after presentation/fallback issue assembly and before path eligibility.
3. Deepen updates path evidence: `hasAmount` / `hasTranscript` / tax year when transcript establishes them.
4. Fail-closed: no transcript balance → issues unchanged.

## Non-goals

- Admin ConversationIntelligence diagnostics
- Rewriting presenter prompts
- Changing Package F fallback deepen behavior (still used when AI is off)

## Check

```bash
npm run test:package-l
```
