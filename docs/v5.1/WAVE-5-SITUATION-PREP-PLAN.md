# Wave 5 — Situation → Prep Plan → Agency Matter

**Status:** shipping  
**Gate:** `npm run test:phase-s`  
**Imm analogue:** Phase S (Situation / Filing Plan / Case lifecycle)

## Locked product lifecycle

```
Question → Situation → Prep Plan → Agency Matter (Case)
```

- **Situation (`SIT-`)** = open tax question / pre-filing options workspace. Not a Case.
- **Prep Plan** = preparation sequence for a chosen pathway (installment, CNC, OIC, penalty abatement, …). Never runs V5.1 Case analysis.
- **Case (`TOM-`)** = something is (or was) before the IRS / state DOR / Tax Court / Collections.
- Workspace routing is **silent** — never ask “Want me to open a case?”
- Conversation **response_mode** controls Case engine invocation; workspace alone never triggers V5.1.

## Option B architecture

First-class `Situation` + `PrepPlan` models. `Case.situationId` optional link. `Document` / `QaThread` may attach to a Situation without a Case.

## Deliverables

| Slice | Check |
| --- | --- |
| S1 Router + intake branch | `phase-s1-situation-router-check.ts` |
| S2 Situation workspace UI | `phase-s2-situation-workspace-check.ts` |
| S3 Prep Plan + billing quota | `phase-s3-prep-plan-check.ts` |
| S4 Case = agency matter + reclassify CLI | `phase-s4-case-lifecycle-check.ts` |
| S5 Customer-facing copy | `phase-s5-customer-copy-check.ts` |
| S6 Regression pack | `phase-s6-workspace-regression-check.ts` |
| Discovery (nav/dashboard) | `phase-s-situation-discovery-check.ts` |

## Situation discovery

- Nav: **My situations** + **My cases**
- Dashboard loads Situations with `.catch` harden
- Guest claim attaches Situations; `continuePathAfterAuth` prefers Situation over Case
- `/api/health` `situation_table` is part of `schemaReady`

## Out of scope

- Wave 6 V5.1 matter integrity stack
- Wave 7 Experience L0–L7 publish (Situation stores `learningEventJson` only)
