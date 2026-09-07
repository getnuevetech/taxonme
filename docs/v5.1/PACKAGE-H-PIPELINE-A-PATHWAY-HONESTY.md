# Package H — Pipeline A pathway honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages A–G (Pipeline B honesty); Wave 4 conversation intelligence

## Locks

1. Thin debt talk (“I owe… not sure how much”) must **not** expand into installment / CNC / OIC / Form 9465 / dollar-threshold playbooks.
2. Resolution pathway branches appear only when `canSurfaceResolutionPathways` passes (known balance, or IRS record + year/options context).
3. Prep Plan inference: bare `owe` / `balance due` → **establish account position**, not installment.
4. Explicit `selectedPathway: installment_agreement` still builds the installment Prep Plan template.

## Check

```bash
npm run test:package-h
```
