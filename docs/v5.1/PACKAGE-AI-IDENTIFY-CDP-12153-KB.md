# Package AI — Identify-only Form 12153 / CDP KB

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Packages Y/Z/AF/AH identify seeds + playbook gates (`RESOLUTION_PLAYBOOK_RE`). Does not reopen Form 433, Y LT11/CP14/SFR wording, or AH examination KB.

**Letter:** **AI is free** (guide ends at **AH**; **L** is “AI-path transcript deepen,” not letter AI). No open PR or prior `PACKAGE-AI-*` charter.

## Research snapshot (pre-implement)

| Area | Finding |
|------|---------|
| Dedicated Form 12153 / CDP form seed | **None** — gap AH explicitly deferred |
| FAQ (`ContentPage` faq slug) | **No** 12153 / CDP / due-process mentions |
| LT11 (Package Y) | Mentions CDP rights + Form 12153 once as deadline context — **leave untouched** |
| CP504 / collection ladder / CP3219A | Name CDP rights only to distinguish stages — **leave untouched** |
| TC codes | `TC 971` + “collection due process” = request received — **leave untouched** |
| `RESOLUTION_PLAYBOOK_RE` | Does **not** match Form 12153 / CDP (safe for identify seeds) |

## Locks

1. Add **identify-only** knowledge seeds for **Form 12153** and **CDP hearing rights**, plus an **LT11 notice vs Form 12153** identity split — what the right/form is, deadline evidence ask, Account Transcript — **no** installment / CNC / OIC / Form 9465 / `$50k` menus (Y gates).
2. **MUST NOT** be a Form 12153 filing wizard (no line-by-line, mail address, checkbox, “how to complete/file,” hearing-strategy, or Tax Court petition playbooks).
3. **Distinguish** LT11 / Letter 1058 (final levy **notice** that offers CDP rights + printed deadline) from Form 12153 (the **request form** identity). Do not rewrite the Y LT11 seed body.
4. Upsert via Package G/Y seed path; content changes clear embeddings.
5. Thin fixture retrieval remains playbook-free under Package Y gates; Form 12153 / CDP / LT11-vs-12153 queries surface identify/evidence copy only.
6. Charter + `npm run test:package-ai` + CI; guide row **AI**; WAVE-4 index link.

## Non-goals

- Form 433 / Collection Information Statement / financial-statement interview _(still deferred)_
- Reopening Package Y LT11 / CP14 / SFR seed prose or gate regex
- Reopening Package AH CP2000 / CP3219A / underreporter ladder
- FAQ / Form 9465 tip / intake chips (AA–AE)
- AG composer / starter chrome
- Filing wizard, Appeals hearing prep, NFTL deep dive, equivalent-hearing strategy menu
- Weakening `RESOLUTION_PLAYBOOK_RE`

## Exact seed drafts (implement verbatim unless review edits)

### 1. Form 12153 — Request for Collection Due Process hearing

```ts
{
  title: "Form 12153 — Request for Collection Due Process hearing",
  sourceType: "rule",
  reference: "Form 12153",
  tags: "form 12153, cdp, collection due process, hearing request, identify, evidence",
  // Package AI — CDP / Form 12153 identify-only. No resolution playbooks; not a filing wizard.
  content:
    "Form 12153 is the IRS form used to request a Collection Due Process (CDP) hearing — or, when rules allow after the CDP window, an equivalent hearing. It is a hearing-request form identity, not a payment arrangement, settlement, or financial statement. CDP rights are typically offered on a final levy notice such as LT11 / Letter 1058 (or certain lien notices); that notice grants the rights and prints the respond-by window, while Form 12153 is the named request form. Calendar any deadline on the levy or lien notice you actually received, keep that notice with the form identity, and confirm the balance and recent activity on an Account Transcript. This guide identifies the form and the right — it does not walk through completing or filing Form 12153, and it does not choose a resolution path.",
}
```

### 2. Collection Due Process (CDP) hearing rights — identify

```ts
{
  title: "Collection Due Process (CDP) hearing rights — identify",
  sourceType: "rule",
  reference: "CDP hearing rights",
  tags: "cdp, collection due process, hearing rights, lt11, deadline, identify, evidence",
  // Package AI — CDP rights identify-only. No resolution playbooks; not a hearing wizard.
  content:
    "Collection Due Process (CDP) hearing rights let a taxpayer ask IRS Appeals for an independent review of certain collection actions after a qualifying notice — most often a final notice of intent to levy (LT11 / Letter 1058) or a notice of federal tax lien. The printed deadline on that notice is the first evidence to calendar; the CDP request window is generally short (often about 30 days from the notice date). Form 12153 is the named request form for a CDP or equivalent hearing; it is not the levy notice itself. Confirm the notice code, notice date, tax periods, and account position on an Account Transcript before treating any guide as selecting arguments or a balance resolution. This guide identifies CDP rights — it is not a hearing-preparation or form-filing wizard.",
}
```

### 3. LT11 notice vs Form 12153 — identify which you have

```ts
{
  title: "LT11 notice vs Form 12153 — identify which you have",
  sourceType: "rule",
  reference: "LT11 vs Form 12153",
  tags: "lt11, letter 1058, form 12153, cdp, identify, notice vs form, evidence",
  // Package AI — notice vs form identity split. Do not reopen Y LT11 seed body.
  content:
    "An LT11 / Letter 1058 is a final notice of intent to levy that notifies of Collection Due Process (CDP) hearing rights and usually prints a respond-by date. Form 12153 is a separate request form used to ask for a CDP hearing (or an equivalent hearing when rules allow). Holding an LT11 is not the same as having requested a hearing with Form 12153; seeing Form 12153 language is not the same as holding the levy notice that started the deadline. Read the notice code and deadline on any LT11 first, identify whether Form 12153 is the form in question, and confirm the Account Transcript. This guide separates notice identity from form identity — it does not complete the form or select a collection resolution.",
}
```

**Do not** change Y LT11 content (already names Form 12153 once). **Do not** add Form 12153 into “Identifying an IRS notice” CP/LT example list (12153 is a form, not a CP/LT code).

## Files to touch (implementation pass)

| File | Change |
|------|--------|
| `docs/v5.1/PACKAGE-AI-IDENTIFY-CDP-12153-KB.md` | This charter (done at charter time) |
| `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md` | Add row **AI** after **AH** |
| `docs/v5.1/WAVE-4-CONVERSATION-INTELLIGENCE.md` | Index link to Package AI |
| `docs/v5.1/PACKAGE-AH-IDENTIFY-EXAM-KB.md` | Optional: leave “→ Package AI” as-is (already correct) |
| `prisma/seed.ts` | Insert the three seeds after AH block; comment `Package AI — CDP / Form 12153 identify-only` |
| `scripts/phase-package-ai-check.ts` | New check mirroring AF/AH (below) |
| `package.json` | `"test:package-ai": "tsx scripts/phase-package-ai-check.ts"` |
| `.github/workflows/ci.yml` | `npm run test:package-ai` after AH |

**Do not touch:** `src/lib/authority-gates.ts` (`RESOLUTION_PLAYBOOK_RE`), Y LT11/CP14/SFR seeds, AH exam seeds, FAQ body, Form 433 / CIS content.

## Gate assertions (mirror AF/AH)

```ts
const THIN_FIXTURE =
  "I owe IRS some money but I am not sure how much and what I need to do.";

// Same family as AF/Y — Form 12153 is the *topic*, so do NOT ban it here (unlike AH exam PLAYBOOK_RE).
const PLAYBOOK_RE =
  /installment\s+agreement|form\s*9465|payment\s+plan|offer\s+in\s+compromise|\bOIC\b|currently[\s-]?not[\s-]?collectible|\bCNC\b|\$\s?50,?000|\$\s?100,?000|Form\s*433/i;

const WIZARD_RE =
  /how to (complete|fill|file|mail)|line[- ]by[- ]line|mail (the )?form to|checkbox|step \d|hearing strateg|petition the (U\.?S\.? )?Tax Court/i;

const AI_TITLES = [
  "Form 12153 — Request for Collection Due Process hearing",
  "Collection Due Process (CDP) hearing rights — identify",
  "LT11 notice vs Form 12153 — identify which you have",
] as const;
```

Static seed asserts:

- Each AI title present; comment `Package AI — CDP / Form 12153 identify-only` (or equivalent).
- Each AI `content` length > 40; `doesNotMatch(PLAYBOOK_RE)`; `doesNotMatch(WIZARD_RE)`.
- Each matches identify/evidence: `/Account Transcript|Calendar|identify|Confirm|Form 12153|CDP|LT11/i`.
- Form 12153 seed matches `/Form 12153/` and `/LT11|Letter 1058/`; CDP seed matches `/Form 12153/` and `/Account Transcript/`; LT11-vs-12153 seed matches both `/LT11/` and `/Form 12153/` and separates notice vs form (`/not the same|separate|vs/i`).
- Y LT11 block still matches Package Y wording (`30 days` + Form 12153 mention) — **unchanged**.
- AH titles/content still present — **unchanged**.

Live retrieval (upsert AI rows via `knowledgeSourceWriteData` + clear embeddings on content change):

- `authorityGateOptsFromQuery(THIN_FIXTURE).allowResolutionPlaybooks === false`
- Thin hits `doesNotMatch(PLAYBOOK_RE)`
- Query `"What is Form 12153 for a CDP hearing?"` → match `/Form 12153|CDP/i`; `doesNotMatch(PLAYBOOK_RE)`; `doesNotMatch(WIZARD_RE)`; match `/Account Transcript|identify|LT11/i`
- Query `"What are Collection Due Process hearing rights?"` → match `/CDP|Collection Due Process/i`; `doesNotMatch(PLAYBOOK_RE)`; `doesNotMatch(WIZARD_RE)`
- Query `"What is the difference between an LT11 and Form 12153?"` → match `/LT11/` and `/Form 12153/`; `doesNotMatch(PLAYBOOK_RE)`
- `activeCount >= 21` (AH floor was 18; +3 AI seeds)
- Charter / guide **AI** row / `test:package-ai` / CI step present

## Check

```bash
npm run test:package-ai
# also keep green: test:package-y test:package-af test:package-ah
```
