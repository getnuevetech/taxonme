# Package AO — Fallback / Case notice agree–disagree honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package AJ (Pipeline A no bare agree menu); Package Q (letter CTA gated); Package AD (confirm-resolution discipline). Does not reopen Form 433, FAQ, or Y gates.

## Locks

1. Case `notice_response` (fallback) must **not** use a bare agree / partially agree / disagree menu — use identify + evidence (printed amounts vs Account Transcript) before sizing a written response.
2. Thin notice (code mentioned, notice doc not on file): `next_action` must **not** be `DRAFT_LETTER`; draft path step only when notice is on file.
3. Confirm-resolution must **not** open from bare `noticeCodes.length > 0` alone.
4. Refund-offset “agree with the underlying balance” wording stays (different meaning).
5. Charter + `npm run test:package-ao` + CI; guide row **AO**.

## Non-goals

- CP501/CP504 composer leftovers _(→ Package AP)_
- Reopening AJ composer / AH–AL seeds / AM lien chrome
- Presenter sanitize rewrite
- Form 433 / FAQ / Y playbook reopen
- Changing `canSurfaceResolutionPathways`

## Check

```bash
npm run test:package-ao
```
