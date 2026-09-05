# Package A — Evidence-proportional honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Goal:** Stop inventing user goals, fake conflicts, and unsupported analysis modules on thin intake — without collapsing TaxOnMe into a single static scenario.

## Locks

1. **USER_REPORTED_GOAL** is immutable; mechanisms live in `potential_resolution_options`.
2. Consensus treats synonymous **prose** as consistent; only **material facts** become customer conflicts.
3. Unsupported modules (explanations, premature penalty/installment paths, $50k/FTA framing on empty evidence) **emit empty / omit**.

## Non-goals (Package B/C)

- Dynamic first-ask UX polish beyond thin template
- Authority timing / AEP seed refresh
- Real-world path completion state machine
- Paywall safety ordering

## Check

```bash
npm run test:package-a
```

Canonical thin fixture: *“I owe IRS some money but I am not sure how much and what I need to do.”*
