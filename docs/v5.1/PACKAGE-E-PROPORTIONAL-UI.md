# Package E — Evidence-proportional UI (empty module = render nothing)

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages A–D

## Locks

1. Thin intake does **not** render “How we reached this,” “Why TaxOnMe says this,” speculative explanations, or premature resolution path steps.
2. `thinBalanceDueFinding` ships an **empty** `analysis_outline` (UI omits the module).
3. Path Forward section mounts only when filtered steps remain; thin cases drop “confirm resolution” / installment / penalty stubs.
4. Document checklist on thin intake is capped (≤2 ranked sources).
5. Readiness early-stage checklist uses real thin detection + evidentiary fact counts (not a hard-coded `0`).

## Check

```bash
npm run test:package-e
```
