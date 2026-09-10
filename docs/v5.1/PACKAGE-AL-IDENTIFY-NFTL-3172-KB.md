# Package AL — Identify-only Letter 3172 / NFTL KB

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages Y/Z/AF/AH/AI identify seeds + playbook gates (`RESOLUTION_PLAYBOOK_RE`). Does not reopen Form 433, Y LT11, AI Form 12153/CDP bodies, FAQ, or AK 433-F labeling.

**Letter:** **AL is free** (guide ends at **AK**; tip of `origin/main` is Package AK merge `ec19d92`). No prior `PACKAGE-AL-*` charter or open PR. AJ/AK non-goals already point here.

## Research snapshot (pre-implement)

| Area | Finding |
|------|---------|
| Dedicated Letter 3172 / NFTL seed | **None** — gap AJ/AK explicitly deferred |
| FAQ (`ContentPage` faq slug) | **No** 3172 / NFTL / “federal tax lien” mentions |
| Composer / Pipeline A starters | **No** 3172 / NFTL copy (generic CP2000 / LT11 identify prompts only) |
| AI CDP / Form 12153 seeds | Name “notice of federal tax lien” / “certain lien notices” once as CDP context — **leave untouched** |
| Y LT11 / collection ladder / CP504 | Levy track only — **leave untouched** |
| `Identifying an IRS notice` examples | Lists CP14…LT11 — **no Letter 3172**; refresh in AL |
| TC codes seed | CDP TC 971 note only — **leave untouched** |
| `RESOLUTION_PLAYBOOK_RE` | Does **not** match NFTL / 3172 / lien (safe for identify seeds) |

## Locks

1. Add **identify-only** knowledge seeds for **Letter 3172**, **Notice of Federal Tax Lien (NFTL)**, plus a **Letter 3172 / NFTL vs LT11 / Form 12153** identity split — what the letter/filing is, deadline evidence ask, Account Transcript — **no** installment / CNC / OIC / Form 9465 / `$50k` menus (Y gates).
2. **MUST NOT** name installment / CNC / OIC / Form 9465 playbooks in AL seed bodies.
3. **Distinguish** NFTL / Letter 3172 (lien filing + lien-related CDP notice identity) from **LT11 / Letter 1058** (final **levy** notice), from **CDP rights** generally (already covered by AI), and from **Form 12153** (the **request form**). Do not rewrite Y LT11 or AI seed bodies.
4. Refresh **Identifying an IRS notice** examples to include **Letter 3172** (keep CP501 / CP3219A / LT11).
5. Upsert via Package G/Y seed path; content changes clear embeddings.
6. Thin fixture retrieval remains playbook-free under Package Y gates; Letter 3172 / NFTL / vs-LT11-12153 queries surface identify/evidence copy only.
7. Charter + `npm run test:package-al` + CI; guide row **AL**; WAVE-4 index link.

## Non-goals

- Form 433 / Collection Information Statement / financial-statement interview _(still deferred)_
- Reopening Package Y LT11 / CP14 / SFR seed prose or gate regex
- Reopening Package AI Form 12153 / CDP / LT11-vs-12153 seed prose
- FAQ / Form 9465 tip / intake chips (AA–AE)
- AG/AJ composer / starter chrome _(→ Package AM for Letter 3172 / NFTL)_
- NFTL withdrawal / discharge / subordination strategy menu; Form 12153 filing wizard; Appeals hearing prep
- Mass FAQ / Y reopen
- Weakening `RESOLUTION_PLAYBOOK_RE`

## Exact seed drafts (implement verbatim unless review edits)

### 1. Letter 3172 — Notice of Federal Tax Lien Filing

```ts
{
  title: "Letter 3172 — Notice of Federal Tax Lien Filing",
  sourceType: "notice_guide",
  reference: "Letter 3172",
  tags: "letter 3172, nftl, federal tax lien, lien notice, identify, evidence, deadline",
  // Package AL — Letter 3172 / NFTL identify-only. No resolution playbooks; not a filing wizard.
  content:
    "Letter 3172 notifies that the IRS has filed a Notice of Federal Tax Lien (NFTL) and typically states Collection Due Process hearing rights related to that lien filing. It is a lien-notice identity, not a final levy notice (LT11 / Letter 1058) and not Form 12153. Calendar any printed deadline on the Letter 3172 you actually received, keep the letter with any NFTL paperwork, and confirm the balance and recent activity on an Account Transcript. This guide identifies the letter — it does not walk through requesting a hearing, releasing a lien, or choosing a payment path.",
}
```

### 2. Notice of Federal Tax Lien (NFTL) — identify

```ts
{
  title: "Notice of Federal Tax Lien (NFTL) — identify",
  sourceType: "rule",
  reference: "NFTL",
  tags: "nftl, notice of federal tax lien, lien, letter 3172, identify, evidence",
  // Package AL — NFTL identify-only. No resolution playbooks; not a lien-release wizard.
  content:
    "A Notice of Federal Tax Lien (NFTL) is a public filing that records the IRS claim against a taxpayer's property for unpaid tax. Letter 3172 is the common taxpayer letter that the NFTL was filed and that hearing rights may apply. An NFTL is not the same as an LT11 / Letter 1058 final intent-to-levy notice, and it is not Form 12153. Confirm tax periods and account position on an Account Transcript; calendar any deadline printed on the Letter 3172 or other lien notice you hold. This guide identifies the NFTL — it does not select a lien release, withdrawal, discharge, or balance-resolution path.",
}
```

### 3. Letter 3172 / NFTL vs LT11 / Form 12153 — identify which you have

```ts
{
  title: "Letter 3172 / NFTL vs LT11 / Form 12153 — identify which you have",
  sourceType: "rule",
  reference: "Letter 3172 vs LT11 vs Form 12153",
  tags: "letter 3172, nftl, lt11, form 12153, cdp, identify, notice vs form, evidence",
  // Package AL — lien vs levy vs form identity split. Do not reopen Y LT11 or AI seed bodies.
  content:
    "Letter 3172 and the Notice of Federal Tax Lien (NFTL) concern lien filing and related hearing-notice identity. An LT11 / Letter 1058 is a final notice of intent to levy that offers Collection Due Process (CDP) rights tied to levy action. Form 12153 is a separate request form used to ask for a CDP hearing (or an equivalent hearing when rules allow) after a qualifying levy or lien notice. Holding Letter 3172 or an NFTL is not the same as holding an LT11, and none of those is the same as having requested a hearing with Form 12153. Read the letter or notice code and any printed deadline first, then confirm the Account Transcript. This guide separates lien, levy, and form identities — it does not complete Form 12153 or select a collection resolution.",
}
```

### 4. Refresh — Identifying an IRS notice (examples only)

Replace the example-code clause so Letter 3172 appears alongside existing codes (**do not** otherwise rewrite the seed):

```ts
// before (AH/AI tip):
"Read the code first (for example CP14, CP501, CP503, CP504, CP2000, CP3219A, LT11), then the period and printed figures."

// after (AL):
"Read the code first (for example CP14, CP501, CP503, CP504, CP2000, CP3219A, LT11, Letter 3172), then the period and printed figures."
```

**Do not** change Y LT11 content. **Do not** change AI Form 12153 / CDP / LT11-vs-12153 bodies. **Do not** add Form 12153 into the CP/LT example list (still a form, not a letter code).

## Files to touch (implementation pass)

| File | Change |
|------|--------|
| `docs/v5.1/PACKAGE-AL-IDENTIFY-NFTL-3172-KB.md` | This charter (done at charter time) |
| `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md` | Add row **AL** after **AK** |
| `docs/v5.1/WAVE-4-CONVERSATION-INTELLIGENCE.md` | Index link to Package AL |
| `docs/v5.1/PACKAGE-AK-433F-LABELING-HONESTY.md` | Optional: leave “→ Package AL” as-is (already correct) |
| `prisma/seed.ts` | Insert the three seeds after AI block; refresh Identifying-an-IRS-notice examples; comment `Package AL — Letter 3172 / NFTL identify-only` |
| `scripts/phase-package-al-check.ts` | New check mirroring AF/AH/AI (below) |
| `package.json` | `"test:package-al": "tsx scripts/phase-package-al-check.ts"` |
| `.github/workflows/ci.yml` | `npm run test:package-al` after AK |

**Do not touch:** `src/lib/authority-gates.ts` (`RESOLUTION_PLAYBOOK_RE`), Y LT11/CP14/SFR seeds, AI CDP/12153 seeds, FAQ body, Form 433 / CIS content, composer chrome.

## Gate assertions (mirror AF/AH/AI)

```ts
const THIN_FIXTURE =
  "I owe IRS some money but I am not sure how much and what I need to do.";

// Same family as AF/Y — Letter 3172 / NFTL are the *topics*, so do NOT ban them here.
const PLAYBOOK_RE =
  /installment\s+agreement|form\s*9465|payment\s+plan|offer\s+in\s+compromise|\bOIC\b|currently[\s-]?not[\s-]?collectible|\bCNC\b|\$\s?50,?000|\$\s?100,?000|Form\s*433/i;

const WIZARD_RE =
  /how to (complete|fill|file|mail)|line[- ]by[- ]line|mail (the )?form to|checkbox|step \d|hearing strateg|lien (release|withdrawal|discharge|subordination) (wizard|steps|how to)/i;

const AL_TITLES = [
  "Letter 3172 — Notice of Federal Tax Lien Filing",
  "Notice of Federal Tax Lien (NFTL) — identify",
  "Letter 3172 / NFTL vs LT11 / Form 12153 — identify which you have",
] as const;
```

Static seed asserts:

- Each AL title present; comment `Package AL — Letter 3172 / NFTL identify-only` (or equivalent).
- Each AL `content` length > 40; `doesNotMatch(PLAYBOOK_RE)`; `doesNotMatch(WIZARD_RE)`.
- Each matches identify/evidence: `/Account Transcript|Calendar|identify|Confirm|Letter 3172|NFTL/i`.
- Letter 3172 seed matches `/Letter 3172/` and `/NFTL|Notice of Federal Tax Lien/`; NFTL seed matches `/Letter 3172/` and `/Account Transcript/`; vs-split seed matches `/Letter 3172|NFTL/`, `/LT11/`, and `/Form 12153/` and separates identities (`/not the same|separate|vs/i`).
- Identifying-an-IRS-notice examples match `/Letter 3172/`.
- Y LT11 block still matches Package Y wording (`30 days` + Form 12153 mention) — **unchanged**.
- AI titles/content still present — **unchanged**.

Live retrieval (upsert AL rows via `knowledgeSourceWriteData` + clear embeddings on content change):

- `authorityGateOptsFromQuery(THIN_FIXTURE).allowResolutionPlaybooks === false`
- Thin hits `doesNotMatch(PLAYBOOK_RE)`
- Query `"What is IRS Letter 3172 about a federal tax lien?"` → match `/Letter 3172|NFTL|federal tax lien/i`; `doesNotMatch(PLAYBOOK_RE)`; `doesNotMatch(WIZARD_RE)`; match `/Account Transcript|identify|Calendar/i`
- Query `"What is a Notice of Federal Tax Lien (NFTL)?"` → match `/NFTL|Notice of Federal Tax Lien/i`; `doesNotMatch(PLAYBOOK_RE)`; `doesNotMatch(WIZARD_RE)`
- Query `"What is the difference between Letter 3172, an LT11, and Form 12153?"` → match `/Letter 3172|NFTL/`, `/LT11/`, `/Form 12153/`; `doesNotMatch(PLAYBOOK_RE)`
- `activeCount >= 24` (AI floor was 21; +3 AL seeds)
- Charter / guide **AL** row / `test:package-al` / CI step present

## Check

```bash
npm run test:package-al
# also keep green: test:package-y test:package-af test:package-ah test:package-ai
```
