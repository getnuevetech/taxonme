# Package AS — Identify-only CP515 / CP518 unfiled-return KB

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package Y (SFR identify seed); Packages Z/AF/AQ notice-identity patterns. Does not reopen Form 433, FAQ, or Y SFR body.

**Letter:** **AS is free** (guide ends at **AR**; tip of `origin/main` is Package AR merge). AR non-goals point here as the next identify-KB hole.

## Research snapshot (pre-implement)

| Area | Finding |
|------|---------|
| Dedicated CP515 / CP518 seed | **None** — unfiled-return notice codes missing |
| SFR / IRC 6020(b) (Y) | Substitute-for-return identity — **leave untouched** |
| Composer | Generic shell for CP515/CP518 — chrome _(→ Package AT)_ |
| `Identifying an IRS notice` examples | No CP515/CP518 — **refresh in AS** |
| AH thin-fixture Form 12153 gate | Do **not** name `Form 12153` in AS seed bodies |

## Locks

1. Add **identify-only** knowledge seeds: **CP515**, **CP518**, and **CP515 / CP518 vs Substitute for Return (SFR)** identity split — what the notice is, tax-year / Account Transcript evidence ask — **no** installment / CNC / OIC / Form 9465 / `$50k` menus; **no** `Form 12153` literal.
2. **Distinguish** CP515/CP518 (unfiled-return notice identity) from **SFR / IRC 6020(b)** (IRS-prepared return assessment) and from the **balance-due collection ladder** (CP14→…→LT11/CP90). Do not rewrite Y SFR, AF ladder, or AQ CP90 bodies.
3. Refresh **Identifying an IRS notice** examples to include **CP515** (keep CP90 / Letter 3172 / CP501).
4. Upsert via Package G/Y seed path; content changes clear embeddings.
5. Thin fixture retrieval remains playbook-free under Package Y/AH gates; CP515 / CP518 / vs-SFR queries surface identify/evidence copy only.
6. Charter + `npm run test:package-as` + CI; guide row **AS**; WAVE-4 index link.

## Non-goals

- Form 433 / CIS full interview _(deferred)_
- Reopening Y SFR / AF ladder / AQ CP90 seed prose
- FAQ / Form 9465 / intake chips
- Pipeline A composer CP515/CP518 chrome _(→ Package AT)_
- Next identify-KB hole after AT _(→ Package AU)_
- Mass FAQ / Y playbook gate reopen
- Changing `canSurfaceResolutionPathways` or `RESOLUTION_PLAYBOOK_RE`

## Exact seed drafts

### 1. CP515 — Request for tax return / unfiled-return notice

```ts
{
  title: "CP515 — Request for tax return (unfiled)",
  sourceType: "notice_guide",
  reference: "CP515",
  tags: "notice, cp515, unfiled, tax return, delinquency, identify, evidence",
  content:
    "A CP515 is typically an IRS notice that a required tax return appears unfiled for a listed tax period. It asks you to file the return or explain why no return is due. It is an unfiled-return notice identity — not a balance-due collection ladder notice (such as CP14 or CP504) and not by itself a Substitute for Return (SFR) assessment. Confirm the printed tax period and any respond-by language on the notice. Pull an Account Transcript and, when income is unclear, a Wage & Income transcript for the same period. This guide identifies the notice — it does not choose a filing, payment, or relief path.",
}
```

### 2. CP518 — Further unfiled-return notice

```ts
{
  title: "CP518 — Further unfiled-return notice",
  sourceType: "notice_guide",
  reference: "CP518",
  tags: "notice, cp518, unfiled, tax return, delinquency, identify, evidence",
  content:
    "A CP518 is typically a further IRS notice that a required tax return still appears unfiled after earlier contact such as a CP515. It restates the tax period and urges a response. It remains an unfiled-return notice identity — not a final levy notice (LT11 / CP90) and not the same as an SFR assessment under IRC 6020(b). Calendar any printed deadline, keep the notice, and confirm filing and assessment activity on an Account Transcript for that period. This guide identifies the notice — it does not choose a filing, payment, or relief path.",
}
```

### 3. CP515 / CP518 vs Substitute for Return (SFR) — identify which you have

```ts
{
  title: "CP515 / CP518 vs Substitute for Return (SFR) — identify which you have",
  sourceType: "rule",
  reference: "CP515 vs CP518 vs SFR",
  tags: "cp515, cp518, sfr, substitute for return, unfiled, identify, notice identity, evidence",
  content:
    "CP515 and CP518 are unfiled-return notices: the IRS believes a required return is missing for a tax period and asks for the return or an explanation. A Substitute for Return (SFR) under IRC 6020(b) is a different identity — an IRS-prepared return that can create an assessment when the taxpayer did not file. Holding a CP515 or CP518 is not the same as having an SFR assessment on the Account Transcript. Read the CP code and tax period on the notice you hold, then confirm whether an SFR or original return posting appears on the Account Transcript. This guide separates unfiled-return notice identity from SFR assessment identity — it does not select a filing or collection resolution.",
}
```

### 4. Refresh — Identifying an IRS notice (examples only)

```ts
// before (AQ tip):
"Read the code first (for example CP14, CP501, CP503, CP504, CP90, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures."

// after (AS):
"Read the code first (for example CP14, CP501, CP503, CP504, CP90, CP515, CP518, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures."
```

## Check

```bash
npm run test:package-as
```
