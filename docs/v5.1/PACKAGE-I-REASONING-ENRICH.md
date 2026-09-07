# Package I — Conversation reasoning enrichment

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Wave 4 conversation intelligence; Wave 7 experience search; Packages A–H

## Locks

1. `enrichIntelligenceWithReasoningModel` is no longer a no-op — live Pipeline A paths await it after `runConversationIntelligence`.
2. Experience Search may **reorder/suppress existing** `ask_now` items via production pattern hints — it must **not** invent new clarify questions or document facts.
3. Optional PRIMARY_REASONING refine may update only `interpreted_question` / allowlisted `decision_target` when routing confidence is low (or clarify-first) — fail closed if no provider/key or parse fails.
4. `model-capabilities` documents role surfaces: reasoning may refine contract labels; never invent document facts or state authority from this hook.

## Call sites

- `src/actions/user.ts` (Q&A)
- `src/actions/case.ts` (guest intake + create case → Situation/Q&A)

## Check

```bash
npm run test:package-i
```
