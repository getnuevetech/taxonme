# Package Q — Notice-explainer honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package P (gated notice retrieval); Package O sanitize pattern; Package K LT11 Pipeline A tweak

## Locks

1. NOTICE prompts supersede to `RESP-NOT-ANL-v31`, `NOTICE-OVERLAY-v33`, `SCHEMA-NOTICE-v31` — empty optional arrays preferred; no FTA/installment/OIC/CNC/$50k playbooks on thin/unknown notices.
2. `sanitizeNoticeExplanation` fail-closed strips playbook prose and fat resolution steps when the notice is thin (unknown code, `NEEDS_VERIFICATION`, or no amount/deadline).
3. Deterministic notice fallback uses sparse identify / deadline / transcript steps; keeps Package P gated KB for meaning only.
4. Notices UI hides next-step lists when status is `verification_required` / unknown type, and letter CTA only when `explained` with a known type.
5. Upload mapping marks unknown / needs-verification notices as `verification_required`.

## Non-goals

- New KB seed corpus / vector search
- Case presenter rewrite (Package O)
- Approval-gate / letter pipeline changes _(→ Package V)_
- Experience L3/L4 corpus depth
- Full Form 433 financial-statement interview

## Check

```bash
npm run test:package-q
```
