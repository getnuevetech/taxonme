# Package O — Presenter honesty (thin intake)

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package A/E (empty modules); Package L (transcript deepen remains post-hoc upgrade)

## Locks

1. Thin AI presenter issues are fail-closed sanitized via `sanitizeThinPresenterIssues` after Package L deepen: empty `explanations` / `analysis_outline`, `missing_info` + `needs_verification` for speculative `balance_due` without amount.
2. Speculative resolution playbook wording (FTA / installment / OIC / CNC / $50k–$100k) on thin debt is replaced with `thinBalanceDueFinding`.
3. Presenter prompts supersede to `RESP-PRES-v31`, `PRES-OVERLAY-v31`, `SCHEMA-PRES-v31` (empty optional arrays allowed/preferred).
4. Customer UI gates “Most likely explanations” with `shouldShowExplanations` (transcript/arithmetic-backed only).
5. With transcript-established balance, Package L deepen still upgrades; sanitize does not undo confirmed amounts.

## Non-goals

- Broader authority retrieval rewrite
- Experience L3/L4 corpus depth
- Notice-explainer full rewrite
- Admin mutate / re-run enrichment

## Check

```bash
npm run test:package-o
```
