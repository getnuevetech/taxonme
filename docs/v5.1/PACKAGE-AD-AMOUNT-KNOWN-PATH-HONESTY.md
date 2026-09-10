# Package AD — Amount-known path honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages F (transcript deepen), AA/AB (9465 tip/prefill), AC (lifecycle). Does not reopen Form 433 or authority KB gates.

## Locks

1. Fallback `balance_due` outline must **not** name “streamlined thresholds” when amount is known but composition is unconfirmed — use amount-based IRC §6159 eligibility once composition is confirmed.
2. Form 9465 path step opens only when installment-eligible **and** (Account Transcript establishes the balance **or** the user asked for installment/payment plan) — not from a bare user-reported dollar amount alone.
3. “Confirm the resolution with the IRS” only after a real response / payment-prep / notice step exists — not amount alone.
4. Case analysis CTAs for `COMPLETE_FORM_9465` say **Prepare Form 9465 request** (draft), not “Start/Open the payment plan form.”
5. Path-step purpose dedupe must not collapse Form 9465 prep (or confirm-resolution) into generic “assess resolution options.”
6. Package F still opens installment path once transcript establishes amount.

## Non-goals

- Form 433 / financial-statement interview
- Intake goal-chip rewrite _(→ Package AE)_
- FAQ / how-it-works / welcome email (Package AC)
- ÷72 PDF/prefill (Package AB); FAQ payment tips (Package AA)
- Changing `shouldRetrieveInstallmentThresholds` / authority KB gating
- Mass Prep Plan / Experience Search rewrite

## Check

```bash
npm run test:package-ad
```
