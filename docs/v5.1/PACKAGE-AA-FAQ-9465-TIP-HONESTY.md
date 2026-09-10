# Package AA — FAQ / Form 9465 tip honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages Y/Z (KB gated); does not reopen authority gates

## Locks

1. FAQ “How do payment plans with the IRS work?” confirms transcript/notice balance first; no absolute `$50,000` / ÷72 “minimum the IRS accepts” claims; wizard prepares a request, not approval.
2. Form 9465 wizard step `help` + `outputTemplate` tip softened the same way.
3. `STEP_TIPS.COMPLETE_FORM_9465` drops ÷72-as-absolute-minimum; keeps practical how-to + direct-debit fee note.
4. Seed refresh: FAQ `contentPage` body updates on re-seed; Form 9465 `stepsJson`/`outputTemplate` refresh when stale playbook copy is still present.
5. Optional: form-prefill suggested-monthly label is illustrative when balance is known (not “the minimum”).

## Non-goals

- Form 433 / financial-statement interview
- Authority KB / Y playbook gates / hybrid retrieval / identify corpus
- Mass FAQ rewrite; Experience Search _(→ Package AC for analysis / how-it-works authorship)_
- Weakening P/U/V/O/Q presenters
- Broad form-prefill redesign _(→ Package AB for ÷72 PDF/prefill injection)_

## Check

```bash
npm run test:package-aa
```
