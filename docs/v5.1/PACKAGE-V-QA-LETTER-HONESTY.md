# Package V — QA + letter playbook honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package O/Q sanitize pattern; Package P/U gated KB (unchanged)

## Locks

1. Thin debt Pipeline A `runQaChat` answers are fail-closed sanitized via `sanitizeQaAnswer` — strip FTA / installment / OIC / CNC / $50k–$100k playbooks; prefer transcript/notice identify copy.
2. Thin `generateLetterDraft` text is fail-closed sanitized via `sanitizeLetterDraft` when amount/IRS record is not established (keeps existing unverified-amount guard).
3. Prompts supersede to `QA-OVERLAY-v33`, `RESP-AST-v31`, `SCHEMA-QA-v31`, `LETTER-OVERLAY-v33`, `RESP-LTR-DRAFT-v31`, `SCHEMA-LETTER-v31`.
4. Never invent replacement playbooks; sparse identify / confirm-account copy only when thin.
5. Gate fixture: “I owe IRS some money but I am not sure how much and what I need to do.”

## Non-goals

- Form 433 / complete financial-statement interview
- Situation / QaThread mass empty-intel backfill _(→ Package W)_
- Force overwrite batch re-enrich _(→ Package X)_
- Broad KB seed corpus / embedding corpus growth
- Experience Search vector rewrite / pgvector
- Case presenter rewrite (Package O) or notice explainer rewrite (Package Q)

## Check

```bash
npm run test:package-v
```
