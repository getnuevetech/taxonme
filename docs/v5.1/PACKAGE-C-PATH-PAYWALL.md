# Package C — Path completion, readiness, paywall safety

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages A + B

## Locks

1. Path Forward comes from ranked/evidence stubs — not a static debt→penalty/installment playbook.
2. `UPLOAD_DOCUMENTS` completes only when **required** evidence kinds exist (transcript/notice), not any file.
3. `REVIEW_ANALYSIS` completes only when a post-doc run exists **and** evidence audit passes.
4. Readiness treats `ACTIVE` unknowns as open; thin cases show an early-stage checklist instead of a misleading %.
5. Paywall never hides urgent / levy / risk findings; issues sort by severity (`urgent` first).

## Check

```bash
npm run test:package-c
```
