# Wave 6 — Matter engine integrity (V5.1 analogue)

**Status:** shipping  
**Gate:** `npm run test:v51` (+ `npm run test:evidence`)  
**Sequence:** `0 → F → A → B → C → E → D → G`

## Goal

When Pipeline B runs on an agency matter, TaxOnMe has the same integrity stack as ImmigrationOnMe — rewritten for IRS/state tax.

## Deliverables

| Phase | Module | Check |
| --- | --- | --- |
| 0 | `V5.1-CORRECTION-SPEC.md` + golden JSON | documentary freeze |
| F | `src/lib/ai/reliability-ceilings.ts` (+ orchestrator wiring) | `test:phase-f` |
| A | classify / labels / plan honesty | `test:phase-a` |
| B | `evidence/fact-ledger.ts`, `authority.ts`, `invalidation.ts` | `test:phase-b` |
| C | `matter-type-lock.ts` three locks | `test:phase-c` |
| E | `approval-gate.ts` | `test:phase-e` |
| D | `action-priority.ts` | `test:phase-d` |
| G | `v51-fixture-pack.ts` | `test:phase-g` |

## Out of scope

- Wave 7 Experience Memory
- Copying Imm VAWA / I-130 fixtures
