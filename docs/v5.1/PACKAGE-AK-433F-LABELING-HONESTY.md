# Package AK — Form 433-F labeling honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Wave 3A forms matrix; Package S ability-to-pay ask policy. Does not build a full CIS interview.

## Locks

1. Form **433-F** catalog description is an **abbreviated draft** — not “financial snapshot / 4 quick steps” that reads as a complete CIS.
2. Expense help and output footer must **not** claim affordable arrangements or that this wizard is the CIS used for payment plans / hardship.
3. Forms list badge/CTA for 433-F: **Abbreviated draft** / **Start abbreviated draft** (other forms keep quiz chrome).
4. Fill wizard finish / done / PDF chrome for 433-F admits abbreviated draft and incomplete official lines.
5. Prep Plan installment/CNC notes: in-app 433-F wizard ≠ full official package.
6. Seed refresh refreshes stale 433-F rows; charter + `npm run test:package-ak` + CI; guide row **AK**.

## Non-goals

- Full Form 433 / CIS interview or new wizard fields
- 433-A / 433-B wizards
- Package S / conversation ask-order changes
- PDF AcroForm map redesign
- Letter 3172 / NFTL identify KB _(→ Package AL)_
- FAQ / homepage mass quiz rewrite

## Check

```bash
npm run test:package-ak
```
