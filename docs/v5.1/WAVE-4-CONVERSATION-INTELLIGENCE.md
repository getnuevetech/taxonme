# Wave 4 — Conversation Intelligence (−1 core)

**Status:** Shipped (core)  
**Date:** 2026-08-31  
**Playbook:** ImmigrationOnMe `src/lib/conversation/*` (tax-rewritten)

## Purpose

Answer tax questions without forcing an agency matter; router is sole authority for Pipeline A vs B.

## Product locks

1. Problem ≠ Agency matter  
2. Router decides A vs B — interpreter only recommends  
3. Upload alone ≠ Matter / Case engine — never promote A→B from document upload alone  
4. Need-to-know clarify — only `critical_now` + `changes_branch`  
5. Silent workspace — guide does not ask “Want me to start a new case?”  
6. Models return JSON / scaffolds; UI owns presentation  

## Deliverables

| Item | Path |
| --- | --- |
| Question Contract + intent + answerability + need-to-know | `src/lib/conversation/*` |
| IRS/state matter signals | `government-matter.ts` |
| Conversation Router | `conversation-router.ts` |
| Pipeline A composer | `assistant-composer.ts` |
| Q&A + intake wiring | `src/actions/user.ts`, `src/actions/case.ts` |
| Guide silent routing | `src/lib/guide.ts` |

## Deferred (later waves)

_(none for −1.8 — see Package J)_

## Follow-on packages

- **Package I** — `model-capabilities` + live `enrichIntelligenceWithReasoningModel`: `PACKAGE-I-REASONING-ENRICH.md`
- **Package J** — Pipeline A UX (−1.8 + minimal −1.7 continuity): structured widgets, starters, focus chrome, promote CTA, guide `?q=` prefill, `QaThread.intelligenceJson`: `PACKAGE-J-PIPELINE-A-UX.md`
- **Package K** — Case clarify → need-to-know planner (evidence-first thin debt asks): `PACKAGE-K-NEED-TO-KNOW-CLARIFY.md`
- **Package L** — AI-path transcript deepen: `PACKAGE-L-AI-PATH-DEEPEN.md`
- **Package M** — Admin ConversationIntelligence diagnostics: `PACKAGE-M-ADMIN-INTELLIGENCE-DIAGNOSTICS.md`
- **Package N** — Case ConversationIntelligence persistence: `PACKAGE-N-CASE-INTELLIGENCE-PERSIST.md`
- **Package O** — Presenter honesty (thin intake): `PACKAGE-O-PRESENTER-HONESTY.md`
- **Package P** — Gated knowledge retrieval (Q&A / notice): `PACKAGE-P-GATED-KNOWLEDGE-RETRIEVAL.md`


## Check

```bash
npm run test:phase-minus1
```
