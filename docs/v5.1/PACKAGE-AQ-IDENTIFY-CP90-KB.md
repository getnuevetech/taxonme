# Package AQ — Identify-only CP90 / ACS final-levy KB

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages Y (LT11), Z/AF (CP504 / ladder), AI (CDP / Form 12153). Does not reopen Form 433, FAQ, or Y LT11 seed body.

**Letter:** **AQ is free** (guide ends at **AP**; tip of `origin/main` is Package AP merge). AP non-goals point here as the next identify-KB hole.

## Research snapshot (pre-implement)

| Area | Finding |
|------|---------|
| Dedicated CP90 seed | **None** — ACS final intent-to-levy identity missing |
| LT11 / Letter 1058 (Y) | Field-collection final levy + CDP — **leave untouched** |
| CP504 (Z) | Urgent levy **warning** before final CDP notice — **leave untouched** |
| Collection ladder (AF) | Ends at LT11 only — **leave untouched** (avoid AF content-string churn) |
| Composer | No CP90 branch (generic shell) — chrome _(→ Package AR)_ |
| `Identifying an IRS notice` examples | No CP90 — **refresh in AQ** |

## Locks

1. Add **identify-only** knowledge seeds: **CP90** (ACS final notice of intent to levy) and **CP90 vs LT11 / Letter 1058 vs CP504** identity split — what the notice is, deadline/CDP evidence ask, Account Transcript — **no** installment / CNC / OIC / Form 9465 / `$50k` menus.
2. **MUST NOT** name installment / CNC / OIC / Form 9465 playbooks in AQ seed bodies.
3. **Distinguish** CP90 (ACS final levy + CDP rights) from **LT11 / Letter 1058** (field-collection final levy + CDP; same rights family, different letter code) and from **CP504** (urgent warning, not the CDP final levy notice). Do not rewrite Y LT11, Z CP504, AF ladder, or AI Form 12153 bodies.
4. Refresh **Identifying an IRS notice** examples to include **CP90** (keep Letter 3172 / CP501 / CP3219A / LT11).
5. Upsert via Package G/Y seed path; content changes clear embeddings.
6. Thin fixture retrieval remains playbook-free under Package Y gates; CP90 / vs-LT11-CP504 queries surface identify/evidence copy only.
7. Charter + `npm run test:package-aq` + CI; guide row **AQ**; WAVE-4 index link.

## Non-goals

- Form 433 / CIS full interview _(deferred)_
- Reopening Y LT11 / AF ladder / Z CP504 / AI 12153 seed prose
- FAQ / Form 9465 / intake chips
- Pipeline A composer CP90 chrome _(→ Package AR)_
- Mass FAQ / Y playbook gate reopen
- Changing `canSurfaceResolutionPathways` or `RESOLUTION_PLAYBOOK_RE`

## Exact seed drafts

### 1. CP90 — Final notice of intent to levy (ACS)

```ts
{
  title: "CP90 — Final notice of intent to levy (ACS)",
  sourceType: "notice_guide",
  reference: "CP90",
  tags: "notice, cp90, levy, acs, collection due process, final notice, identify, evidence",
  content:
    "A CP90 is typically an Automated Collection System (ACS) final notice of intent to levy that notifies of Collection Due Process (CDP) hearing rights. It is a final levy-notice identity in the same rights family as LT11 / Letter 1058, not a mid-ladder reminder and not a CP504 urgent warning alone. Calendar any printed deadline on the CP90 you hold, keep the notice, and confirm the balance and recent activity on an Account Transcript. Form 12153 is the named CDP hearing-request form — holding a CP90 is not the same as having filed Form 12153. This guide identifies the notice — it does not walk through completing Form 12153 or choosing a payment path.",
}
```

### 2. CP90 vs LT11 / Letter 1058 vs CP504 — identify which you have

```ts
{
  title: "CP90 vs LT11 / Letter 1058 vs CP504 — identify which you have",
  sourceType: "rule",
  reference: "CP90 vs LT11 vs CP504",
  tags: "cp90, lt11, letter 1058, cp504, levy, cdp, identify, notice identity, evidence",
  content:
    "A CP90 is an ACS final notice of intent to levy that offers Collection Due Process (CDP) hearing rights. An LT11 / Letter 1058 is the field-collection final levy notice in the same CDP-rights family — different letter codes, same need to calendar the printed deadline. A CP504 is an earlier urgent collection / levy-warning notice on the balance-due ladder; it is not by itself the CDP final levy notice. Read the CP/LT code and any respond-by date on the copy you hold, then confirm the Account Transcript. This guide separates CP90, LT11, and CP504 identities — it does not complete Form 12153 or select a collection resolution.",
}
```

### 3. Refresh — Identifying an IRS notice (examples only)

```ts
// before (AL tip):
"Read the code first (for example CP14, CP501, CP503, CP504, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures."

// after (AQ):
"Read the code first (for example CP14, CP501, CP503, CP504, CP90, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures."
```

## Check

```bash
npm run test:package-aq
```
