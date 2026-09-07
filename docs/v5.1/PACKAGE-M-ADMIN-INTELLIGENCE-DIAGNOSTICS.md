# Package M — Admin ConversationIntelligence diagnostics

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Wave 4 / Packages I–K (stored `intelligenceJson` on Situation + QaThread)

## Locks

1. Read-only summarizer `summarizeConversationIntelligence` / `summarizeFromStoredJson` / `summarizeForCase` exposes decision_target, response_mode, pipeline, workspace, routing_confidence, ask_now, clarification fields, and source (`stored` | `recomputed`).
2. Admin page `/admin/intelligence` (area `admin.ai`) looks up by Situation id / SIT-number, QaThread id, or Case id via `lookupIntelligenceDiagnostics`.
3. Admin Case detail embeds `IntelligenceDiagnosticsPanel`; Cases prefer `Case.intelligenceJson`, then origin Situation, else recompute.
4. Nav: Intelligence → Conversation intel (does not replace `/admin/diagnostics` AI ops).

## Non-goals

- `Case.intelligenceJson` persistence / migration _(→ Package N)_
- Mutate or re-run enrichment from the admin UI
- Replacing AI ops Diagnostics (tokens, queue, readiness)

## Check

```bash
npm run test:package-m
```
