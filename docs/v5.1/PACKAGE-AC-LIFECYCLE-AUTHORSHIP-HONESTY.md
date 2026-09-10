# Package AC — Lifecycle / FAQ authorship honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Wave 5 Situation lifecycle; Packages AA/AB (form honesty). Does not reopen Form 433 or ÷72 PDF injection.

## Locks

1. FAQ “How does the analysis work?” states depth ∝ evidence / Situation-first — no “always a step-by-step plan from thin intake.”
2. `how-it-works` ContentPage maps Question → Situation → evidence; Case = agency matter, not default first click.
3. Welcome `account_created` email leads with Situation, not “Start a case → step-by-step plan.”
4. Guide no-case fallback links **Continue with my situation** (not “Start a case” as the only CTA).
5. Empty case-impact panel and guest result teaser stay Situation-honest; hero subtitle does not promise a universal plan.
6. Seed refresh: FAQ (AA), stale `how-it-works`, stale `account_created`, stale `home.hero_subtitle`.

## Non-goals

- Form 433 / financial-statement interview
- Form 9465 PDF/prefill / FAQ payment-plan tips (AA/AB)
- Intake goal-chip rewrite _(→ later package)_
- Amount-known fallback “streamlined” CTA honesty _(→ later package)_
- Full marketing redesign; Experience Search; authority KB

## Check

```bash
npm run test:package-ac
```
