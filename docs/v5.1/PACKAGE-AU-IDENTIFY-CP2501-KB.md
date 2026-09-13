# Package AU — Identify-only CP2501 underreporter soft-notice KB

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package AH (CP2000 / CP3219A / underreporter ladder). Does not reopen Form 433, FAQ, or AH seed bodies.

**Letter:** **AU is free** (guide ends at **AT**; tip of `origin/main` is Package AT merge). AT non-goals point here as the next identify-KB hole.

## Research snapshot (pre-implement)

| Area | Finding |
|------|---------|
| Dedicated CP2501 seed | **None** — soft underreporter notice before CP2000 missing |
| Underreporter ladder (AH) | CP2000 → CP3219A only — **leave untouched** (avoid AH content-string churn) |
| CP2000 / CP3219A (AH) | **Leave untouched** |
| Composer | Generic shell for CP2501 — chrome _(→ Package AV)_ |
| `Identifying an IRS notice` examples | No CP2501 — **refresh in AU** |
| AH thin-fixture Form 12153 gate | Do **not** name `Form 12153` in AU seed bodies |

## Locks

1. Add **identify-only** knowledge seeds: **CP2501** and **CP2501 vs CP2000 vs CP3219A** identity split — what the notice is, Wage & Income / Account Transcript evidence ask — **no** installment / CNC / OIC / Form 9465 / `$50k` menus; **no** `Form 12153` literal.
2. **Distinguish** CP2501 (earlier / softer underreporter contact) from **CP2000** (proposed underreporter changes) and from **CP3219A** (Statutory Notice of Deficiency). Do not rewrite AH CP2000 / CP3219A / ladder bodies.
3. Refresh **Identifying an IRS notice** examples to include **CP2501** (keep CP515 / CP90 / Letter 3172).
4. Upsert via Package G/Y seed path; content changes clear embeddings.
5. Thin fixture retrieval remains playbook-free under Package Y/AH gates; CP2501 / vs-CP2000 queries surface identify/evidence copy only.
6. Charter + `npm run test:package-au` + CI; guide row **AU**; WAVE-4 index link.

## Non-goals

- Form 433 / CIS full interview _(deferred)_
- Reopening AH CP2000 / CP3219A / underreporter ladder seed prose
- FAQ / Form 9465 / intake chips
- Pipeline A composer CP2501 chrome _(→ Package AV)_
- Mass FAQ / Y playbook gate reopen
- Changing `canSurfaceResolutionPathways` or `RESOLUTION_PLAYBOOK_RE`

## Exact seed drafts

### 1. CP2501 — Underreporter soft notice

```ts
{
  title: "CP2501 — Underreporter soft notice",
  sourceType: "notice_guide",
  reference: "CP2501",
  tags: "notice, cp2501, underreporter, examination, soft notice, identify, evidence",
  content:
    "A CP2501 is typically an earlier underreporter contact: the IRS compared third-party payer information to the return and asks you to review a possible mismatch before a formal CP2000 proposed-adjustment notice. It is a soft underreporter-notice identity — not a bill by itself, not a field audit, and not a Statutory Notice of Deficiency (CP3219A). Confirm the printed tax period, proposed figures if any, and any respond-by language. Compare those figures to a Wage & Income transcript and confirm account activity on an Account Transcript. This guide identifies the notice — it does not choose a payment or relief path.",
}
```

### 2. CP2501 vs CP2000 vs CP3219A — identify which you have

```ts
{
  title: "CP2501 vs CP2000 vs CP3219A — identify which you have",
  sourceType: "rule",
  reference: "CP2501 vs CP2000 vs CP3219A",
  tags: "cp2501, cp2000, cp3219a, underreporter, examination, identify, notice identity, evidence",
  content:
    "A CP2501 is typically an earlier soft underreporter notice asking you to review a possible payer-information mismatch. A CP2000 is a proposed underreporter adjustment notice with proposed changes — still not a bill by itself. A CP3219A is a Statutory Notice of Deficiency that generally opens a limited Tax Court petition window — calendar any printed petition deadline. Read the CP code and tax period on the copy you hold, then confirm figures on Wage & Income and Account Transcripts. This guide separates CP2501, CP2000, and CP3219A identities — it does not select a response or collection resolution.",
}
```

### 3. Refresh — Identifying an IRS notice (examples only)

```ts
// before (AS tip):
"Read the code first (for example CP14, CP501, CP503, CP504, CP90, CP515, CP518, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures."

// after (AU):
"Read the code first (for example CP14, CP501, CP503, CP504, CP90, CP515, CP518, CP2501, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures."
```

## Check

```bash
npm run test:package-au
```
