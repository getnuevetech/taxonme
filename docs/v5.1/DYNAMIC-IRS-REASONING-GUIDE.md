# TaxOnMe — Dynamic IRS reasoning guide

**Status:** Binding product + engineering principle for TaxOnMe development.  
**Audience:** Anyone changing analysis, conversation, presentation, path steps, authority, or intake.  
**Related:** `docs/domain-map.md`, `docs/TAXONME-OPTIMIZATION-EXECUTION-PLAN.md`, V5.1 correction / conversation / experience charters.

---

## 1. Product goal

TaxOnMe exists to help people **navigate IRS (and related tax-authority) problems**:

- Break down and understand **IRS letters, notices, transcripts, and account activity**
- Clarify **tax benefits, liabilities, penalties, interest, credits, and payments**
- Answer **any tax/IRS-related question or issue** a user presents — not a fixed catalog of demos

There are effectively unbounded scenarios. The product succeeds only if it can **reason dynamically** over whatever the user brings, using **online and IRS / authoritative resources**, not static scripts.

---

## 2. Non‑negotiable: dynamic, not scenario‑static

| Do | Do not |
| --- | --- |
| Classify the *this* matter from evidence + user report | Hard-code workflows for “the balance-due case,” “the CP2000 case,” etc. |
| Retrieve and apply **current** authority relevant to *known* facts | Paste generic installment / FTA / levy text because keywords matched |
| Ask the **next decision-changing** question or evidence ask | Always ask for “the amount” or always demand Form 1040 / W-2 |
| Emit UI modules only when supported by evidence or approved analysis | Fill “Most likely explanations,” “Path Forward,” or “Penalty relief” because the template has a slot |
| Separate USER_REPORTED goal from interpreted options | Overwrite the user’s goal with mechanisms the model invents |
| Scale depth with evidence | Produce an 11-page “full analysis” from a two-line intake |

**Depth must be proportional to evidence.** With little evidence, be concise and excellent at determining what is needed next. With substantial evidence, be forensic: extract, reconstruct, ground in current authority, and build a tailored path.

**Empty module = render nothing.** Never populate a customer/consultant surface merely because a UI block exists.

---

## 3. How “dynamic” is implemented (architecture)

Scenario coverage comes from **engines and contracts**, not from enumerating cases in code:

1. **Conversation intelligence (Pipeline A)** — question contract, intent, answerability, need-to-know; answer general IRS/tax questions without forcing a Case.
2. **Situation → Prep Plan → Agency Matter** — only open a matter when something is (or was) before an agency; prep stays preparation, not full analysis.
3. **Evidence ledger + provenance** — USER_REPORTED vs DOCUMENT_* vs SYSTEM_CALCULATED vs IRS_AUTHORITY; no silent promotion.
4. **Authority retrieval** — case-driven queries against curated IRS/IRM/pub/state sources **and** freshness rules; filter by tax period / matter type when known.
5. **Locks + approval gate** — retrieval ≠ presentation ≠ recommendation; fail closed on unsafe advice.
6. **Action ranking** — path steps from approved analysis, not a generic “owe IRS → request penalty relief” script.
7. **Experience / institutional learning** — de-identified patterns improve future reasoning without baking one scenario into the product.

Hardcoded fallbacks (`src/lib/ai/fallback.ts` issue templates, static path builders, issue-type document checklists) are **temporary safety nets**, not the product design. New work must **narrow** their use and route through the engines above.

---

## 4. Development rules (code review checklist)

When changing analysis or presentation, verify:

1. **Any-scenario input** — Would this still behave for an unfamiliar notice code, multi-year mix, business vs individual, state+federal, or a pure Q&A with no matter?
2. **No goal overwrite** — `USER_REPORTED_GOAL` preserved; interpreted outcomes / resolution options are labeled separately.
3. **Conflicts are factual** — compare normalized facts, not synonymous prose.
4. **Evidence gate** — explanations, resolution options, penalty/installment specifics, and assertive finding cards require supporting facts or documents (or are omitted).
5. **Authority timing** — dollar thresholds, FTA/AEP, levy procedures, etc. appear only when applicability facts (e.g. amount, tax year, notice type) exist or the user explicitly asks for general education.
6. **Next step is dynamic** — prefer the best evidence source or clarify ask for *this* state (transcript/notice/help-get-transcript), not a fixed interview script.
7. **Documents are potential evidence** — never mandate 1040/W-2/etc. solely from a coarse issue type.
8. **Path completion is real-world state** — uploading an irrelevant file or drafting a letter ≠ IRS outcome.
9. **Paywall safety** — never hide urgent deadlines, levy/collection harm, or material compliance risk.
10. **Online / IRS resources** — prefer retrieval + cited authority over model memory for material tax-rule claims; keep sources current (e.g. relief policy changes by tax year).

---

## 5. Evidence-proportional presentation (customer view)

For thin intake (e.g. “I owe the IRS something but I’m not sure how much or what to do”):

- One plain finding: what is known / unknown / best next evidence ask  
- Grouped gaps (account position; IRS communication) — not six raw unknown fields  
- No speculative “most likely explanations,” premature penalty-relief path, or generic $50k/$100k primary framing  

After transcripts/notices arrive: deepen — reconstruct events, split tax/penalty/interest, deadlines, collection stage, and **then** retrieve and apply situation-specific authority and options.

---

## 6. Relation to prior review packages

Work packages that enforce this guide (do not treat as “make the app dumber” — they make it **honest and generalizable**):

| Package | Focus |
| --- | --- |
| **A** | Goal provenance; fact-based consensus; omit unsupported modules |
| **B** | Dynamic next ask; evidence-gap documents; authority timing/freshness; compressed unknowns |
| **C** | Approved-analysis path; real completion states; readiness honesty; paywall safety |

Every package must preserve **Pipeline A** (arbitrary IRS/tax questions) and **Pipeline B** (matter engine) as general reasoners — never collapse the product into a single-scenario wizard.

---

## 7. Anti-patterns (reject in review)

- New `if (issueType === "balance_due") { … fixed path / fixed docs / fixed explanations }` without an evidence or matter-lock gate  
- Presenter/fallback schemas that **require** filled arrays for optional modules  
- Seeded “demo” wording that ships as default customer copy for all similar intakes  
- Keyword → full resolution playbook (owe → FTA + installment + letter) before facts exist  
- Treating model disagreement on wording as “sources disagree” for the customer  

---

## 8. Success criterion

TaxOnMe is successful when a user can present **any** IRS-related question, letter, liability, benefit, or collection issue and receive:

1. Discipline under uncertainty (provenance + proportional depth), and  
2. Increasingly precise, authority-grounded guidance as evidence and online/IRS sources are applied to **their** facts — not a canned scenario.
