# Package K — Case clarify → need-to-know planner

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages B/H/J; Wave 4 need-to-know helpers

## Locks

1. `nextClarifyQuestion` prefers Phase −1 `needToKnowClarifyQuestion` (after Package B evidence ask) over schema-fill / unclear loops.
2. Thin debt talk (`amountUnknown` / `!canSurfaceResolutionPathways`) asks for notice/transcript account position — **not** installment vs CNC ability-to-pay.
3. Ability-to-pay clarify remains only when resolution pathways are eligible (known balance or IRS record + year/options context).
4. Unclear issue items that do not help the active decision target are skipped via `unknownHelpsContract`.
5. Optional `reason` surfaces on Case clarify UI for need-to-know asks.

## Non-goals

- Admin ConversationIntelligence diagnostics panel _(→ Package M)_
- Orchestrator AI-path transcript deepen (Package L candidate)
- Full rewrite of notice explainers beyond levy honesty tweak _(→ Package Q)_

## Check

```bash
npm run test:package-k
```
