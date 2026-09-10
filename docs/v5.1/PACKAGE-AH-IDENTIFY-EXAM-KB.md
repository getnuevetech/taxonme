# Package AH — Identify-only examination KB (CP2000 + CP3219A)

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages Y/Z/AF identify seeds + playbook gates. Does not reopen Form 433, Form 12153/CDP depth, FAQ, or AG chrome.

## Locks

1. Harden **CP2000 — Underreported income notice** to identify-only (proposed underreporter ≠ bill/audit; Wage & Income + Account Transcript evidence ask; may lead to CP3219A) — no installment / CNC / OIC / Form 9465 / dollar-threshold menus; no bare agree/disagree response menu without evidence framing.
2. Add **CP3219A — Statutory Notice of Deficiency** — Tax Court petition window as a right + deadline; distinguish from LT11/CDP; identify-only closer.
3. Add **Underreporter notice ladder — identify the stage** (`CP2000 → CP3219A`); do not collapse into the collection ladder.
4. Refresh **Identifying an IRS notice** examples to include **CP3219A** (keep CP501).
5. Upsert via Package G/Y seed path; content changes clear embeddings.
6. Charter + `npm run test:package-ah` + CI; guide row **AH**.

## Non-goals

- Form 12153 / CDP form depth _(→ Package AI)_
- Form 433 / financial-statement interview
- Mass FAQ / Y gate rewrite
- AG composer / starter chrome (including composer CP2000 prose) _(→ Package AJ)_
- Weakening `RESOLUTION_PLAYBOOK_RE`

## Check

```bash
npm run test:package-ah
```
