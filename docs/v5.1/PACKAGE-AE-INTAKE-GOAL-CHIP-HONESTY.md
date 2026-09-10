# Package AE — Intake goal-chip honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package A (goal provenance); AC/AD authorship. Does not reopen Form 433 or authority gates.

## Locks

1. Intake goal chips are **evidence-first outcomes** (what to learn / establish), not resolution mechanisms.
2. Chips must **not** name payment plans, penalty reduction, FTA/AEP, OIC, CNC, or Form 9465 — they append into `USER_REPORTED` goal text.
3. Chip list lives in `src/lib/intake-goal-chips.ts` and is consumed by `IntakeWizard`.
4. Customers may still type a mechanism into the goal field freely; chips just must not inject one.

## Non-goals

- Form 433 / financial-statement interview
- Changing Pipeline A `STARTER_PROMPTS` (Package J)
- Amount-known fallback / 9465 path (Package AD)
- FAQ / lifecycle marketing (Package AC)
- Blocking free-text goals that mention installment or penalties
- Mass intake redesign

## Check

```bash
npm run test:package-ae
```
