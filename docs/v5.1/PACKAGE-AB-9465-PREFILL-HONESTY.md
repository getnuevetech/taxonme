# Package AB — Form 9465 PDF / prefill ÷72 honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package AA (tip/FAQ honesty); does not reopen FAQ tips or authority gates

## Locks

1. Form 9465 official PDF map must **not** auto-fill any AcroForm field from `(amount_owed - down_payment) / 72`.
2. Form prefill must **not** invent `monthly_payment` from balance÷72; the customer proposes the amount.
3. Fact sheet may remind the customer to enter an affordable amount — it must not present a computed ÷72 figure as the suggested fill.
4. Seed refresh: when an existing Form 9465 `pdfMapJson` still contains a `/72` expression, re-apply the honest map.
5. `amount_owed - down_payment` arithmetic for the remaining-balance PDF field stays (user-supplied inputs only).

## Non-goals

- Form 433 / financial-statement interview
- FAQ tip / STEP_TIPS / wizard help prose (Package AA)
- Authority KB / Y–Z gates / hybrid retrieval
- Mass form-prefill redesign for every IRS form
- Inventing ability-to-pay analysis

## Check

```bash
npm run test:package-ab
```
