# Package AW — Identify-only CP49 / TOP refund-offset KB

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package Y (early notice seeds); AO (refund-offset agree wording stays). Does not reopen Form 433, FAQ, or Y LT11 body.

**Letter:** **AW is free** (guide ends at **AV**; tip of `origin/main` is Package AV merge). AV non-goals point here as the next identify-KB hole.

## Research snapshot (pre-implement)

| Area | Finding |
|------|---------|
| CP49 seed | **Exists but soft** — mentions TOP in one clause; not full identify + evidence framing |
| Dedicated TOP seed | **None** — Treasury Offset Program identity missing |
| Composer | Generic shell for CP49 — chrome _(→ Package AX)_ |
| `Identifying an IRS notice` examples | No CP49 — **refresh in AW** |
| AH thin-fixture Form 12153 gate | Do **not** name `Form 12153` in AW seed bodies |
| AO refund-offset Case wording | **Leave untouched** |

## Locks

1. **Harden** CP49 to identify-only (federal tax refund applied to other federal tax; Account Transcript / TC 826 evidence ask) — **no** installment / CNC / OIC / Form 9465 / `$50k` menus; **no** `Form 12153` literal.
2. Add **identify-only** seeds: **Treasury Offset Program (TOP) refund offset** and **CP49 vs TOP** identity split — IRS federal-tax offset notice vs Bureau of the Fiscal Service TOP offset for other debts (e.g. state tax, child support, federal student loans).
3. Refresh **Identifying an IRS notice** examples to include **CP49** (keep CP2501 / CP515 / CP90 / Letter 3172).
4. Upsert via Package G/Y seed path; content changes clear embeddings.
5. Thin fixture retrieval remains playbook-free under Package Y/AH gates; CP49 / TOP / vs queries surface identify/evidence copy only.
6. Charter + `npm run test:package-aw` + CI; guide row **AW**; WAVE-4 index link.

## Non-goals

- Form 433 / CIS full interview _(deferred)_
- Reopening AO refund-offset Case agree wording
- FAQ / Form 9465 / intake chips
- Pipeline A composer CP49 / TOP chrome _(→ Package AX)_
- Mass FAQ / Y playbook gate reopen
- Changing `canSurfaceResolutionPathways` or `RESOLUTION_PLAYBOOK_RE`

## Exact seed drafts

### 1. CP49 — Refund applied to other federal taxes (harden)

```ts
{
  title: "CP49 — Refund applied to other taxes",
  sourceType: "notice_guide",
  reference: "CP49",
  tags: "notice, cp49, refund, offset, federal tax, identify, evidence",
  content:
    "A CP49 tells you that all or part of an expected federal tax refund was applied (offset) to another federal tax debt — often a different tax year. It usually shows which period received the credit and any remaining refund. Confirm the printed periods and amounts on the notice, then compare Account Transcript activity (often including a credit transfer such as TC 826) for both the refund year and the year that received the offset. A CP49 is an IRS federal-tax offset notice identity — not a Treasury Offset Program (TOP) notice for non-IRS debts. This guide identifies the notice — it does not choose a payment or relief path.",
}
```

### 2. Treasury Offset Program (TOP) — refund offset identity

```ts
{
  title: "Treasury Offset Program (TOP) — refund offset identity",
  sourceType: "rule",
  reference: "TOP refund offset",
  tags: "top, treasury offset program, refund, offset, fiscal service, identify, evidence",
  content:
    "The Treasury Offset Program (TOP) can apply a federal tax refund to certain non-IRS debts such as past-due child support, state income tax, or federal student loans. TOP offsets are administered through the Bureau of the Fiscal Service and typically use a Fiscal Service notice — not an IRS CP49. Confirm what debt the Fiscal Service notice lists, then confirm IRS Account Transcript activity for the refund year to see whether an IRS federal-tax offset (CP49 / TC 826) also occurred. This guide identifies TOP offset identity — it does not choose a payment or relief path.",
}
```

### 3. CP49 vs TOP — identify which offset you have

```ts
{
  title: "CP49 vs TOP — identify which offset you have",
  sourceType: "rule",
  reference: "CP49 vs TOP",
  tags: "cp49, top, treasury offset program, refund, offset, identify, notice identity, evidence",
  content:
    "A CP49 is an IRS notice that a federal tax refund was applied to another federal tax liability. A TOP offset is a Bureau of the Fiscal Service action applying a refund to certain non-IRS debts (for example state tax, child support, or federal student loans) and uses a different notice. Holding a CP49 is not the same as receiving a TOP Fiscal Service notice, and either can reduce an expected refund. Read the notice issuer and debt description first, then confirm the refund year on an Account Transcript. This guide separates CP49 and TOP identities — it does not select a collection resolution.",
}
```

### 4. Refresh — Identifying an IRS notice (examples only)

```ts
// before (AU tip):
"Read the code first (for example CP14, CP501, CP503, CP504, CP90, CP515, CP518, CP2501, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures."

// after (AW):
"Read the code first (for example CP14, CP49, CP501, CP503, CP504, CP90, CP515, CP518, CP2501, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures."
```

## Check

```bash
npm run test:package-aw
```
