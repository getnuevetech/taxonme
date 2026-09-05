# Package D — Wire V5.1 approval gate (fail closed)

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages A–C; Wave 6 Phase E (`approval-gate.ts` / `test:phase-e`)

## Locks

1. Customer presentation, issues, and path steps are persisted **only after** `evaluateApprovalGate`.
2. On `gate_result === BLOCK`: presentation is null for analysis; stored presentation is a blocked marker (not the unsafe AI copy); path steps become thin evidence stubs only; safe/fallback issues replace resolution recommendations.
3. BLOCK queues a human-review item and records `approval_gate` on the analysis version snapshot.
4. `selectApprovedPresentation` remains the single approve/refuse helper — retrieval ≠ presentation ≠ recommendation.

## Check

```bash
npm run test:package-d
```
