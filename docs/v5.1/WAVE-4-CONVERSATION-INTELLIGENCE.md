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

- Model Responsibility Contract (`model-capabilities`, document-intelligence roles) — Imm −1 model check  
- −1.7 / −1.8 Pipeline A UX polish (structured widgets, starters)  
- −1.9 Experience L0–L7 (Wave 7)  
- First-class Situation workspace (Wave 5) — today unfiled strategy stays `workspace=situation` without a Situation table  

## Check

```bash
npm run test:phase-minus1
```
