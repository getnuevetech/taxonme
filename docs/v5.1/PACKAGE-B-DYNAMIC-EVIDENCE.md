# Package B — Dynamic next ask, evidence sources, authority timing

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package A (`PACKAGE-A-EVIDENCE-PROPORTIONAL.md`)

## Locks

1. If the user already said the amount is unknown, prefer **notice/transcript** evidence asks over `balance_amount`.
2. Document checklist = **ranked potential evidence**, not issue-type mandates (no automatic 1040/W-2 on thin balance_due).
3. Installment **$50k/$100k** and **FTA/AEP** named programs only when amount / tax year gates pass.
4. Customer unknowns compressed to **≤2 groups** (account position; IRS communication).

## Check

```bash
npm run test:package-b
```
