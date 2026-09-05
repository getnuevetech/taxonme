# Package F — Thin intake → transcript deepening

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages A–E

## Locks

1. Transcript evidence is recognized via `documentType` / filename / text — not only `docKind === "transcript"`.
2. Compile backfills `docKind` when classification identifies a transcript or notice.
3. Thin narrative alone stays sparse; after Account Transcript establishes balance, findings **deepen** (confirmed amount, year, outline, path eligibility).
4. Penalty/interest composition is stated when TC 276/196/166 appear; otherwise composition is not invented.
5. FTA/AEP naming and installment thresholds still require year/amount gates (Package B).

## Check

```bash
npm run test:package-f
```
