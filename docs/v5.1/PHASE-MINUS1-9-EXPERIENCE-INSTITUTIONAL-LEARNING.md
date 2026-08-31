# Phase −1.9 — Tax Experience & Institutional Learning

**Status:** shipped through L7 + S8  
**Date:** 2026-08-31  
**Wave:** `WAVE-7-EXPERIENCE-LEARNING.md`

## Purpose

TaxOnMe captures reusable tax decision patterns while preserving the boundary
between customer-owned turn records and the de-identified shared store:

```text
interaction → L0 record → de-identification → observation/candidate
→ review → L4 Production pattern → Experience Search
```

## Non-negotiable rules

1. Learn patterns and decision logic, not identities.
2. No live fine-tuning.
3. Current authority > reviewed internal rule > validated Production pattern
   > historical experience > model inference.
4. Outcome ≠ law.
5. Only L4 Production patterns influence Experience Search.
6. Shared `ExperienceObservation.anonJson` contains institutional keys only.

## Promotion ladder

| Level | Name | Production retrieval |
| --- | --- | --- |
| L0 | Observation | No |
| L1 | Candidate | No |
| L2 | Supported | No |
| L3 | Reviewed | No |
| L4 | Production | Yes |

## Delivery and acceptance

### L0 — capture

Conversation intelligence builds the real L0/L2 `ExperienceRecord`, including
decision target, considered pathways, selected clarification, suppressed
questions, and response mode. Check: `test:phase-minus1-9-l0`.

### L1 — de-identification

Raw L0 may remain on the owning Situation. Cross-user storage and reads expose
only `l1_anon` records, never narratives, names, email, phone, SSN/EIN/PTIN,
account identifiers, addresses, or filenames. Check:
`test:phase-minus1-9-l1`.

### L2 — what-mattered and negative learning

The canonical balance-due/CP503 turn partitions `ability_to_pay` as
decision-changing and defers `full_form_433_package` /
`complete_financial_statement`. `negative_learning_records` reports avoided,
violated, or not-applicable. Check: `test:phase-minus1-9-l2`.

Seeded lesson `NEG-TAX-RELIEF-SCHEMA-001` says schema completeness must not
outrank pathway relevance. For balance due + collection notice + uncertain
ability to pay, explain relief pathways and ask about payment capacity before
requesting a complete financial package.

### L3 — consultant corrections

Structured institutional correction keys create promotion-level 1 pattern
candidates. A `full_form_433_package` → `ability_to_pay` correction links the
seeded lesson. Consultant identity and free text do not enter the shared
payload. Check: `test:phase-minus1-9-l3`.

### L4 — tax outcomes

Supported outcomes include installment agreement accepted, currently not
collectible, offer in compromise accepted, penalty abatement, notice resolved,
assessment confirmed, and levy released. Publishers are the IRS, state DOR,
and Tax Court; systems are `irs`, `state_dor`, and
`tax_court_collections`. Authority checks are mandatory. Outcomes publish
level 1 candidates and remain `historical_experience`. Check:
`test:phase-minus1-9-l4`.

### L5 — Pattern Registry

`/admin/experience` lists de-identified records and permits reviewed promotion
from 0 through 4. Production requires a reusable signal and decision target.
Check: `test:phase-minus1-9-l5`.

### L6 — Experience Search

Search refuses every record whose `promotion_level` is not exactly 4.
Prompt blocks repeat authority precedence and never infer customer facts from
patterns. Empty or unavailable storage fails closed to an empty block. Check:
`test:phase-minus1-9-l6`.

### L7 — telemetry

Production patterns track help, harm, and last-served timestamps. Three harms
that are at least twice the help count auto-stale a pattern. Stale patterns
cannot serve, and authority-key changes invalidate linked Production
patterns. Check: `test:phase-minus1-9-l7`.

### S8 — fixtures

The Experience regression fixture pack covers capture, de-identification,
negative learning, correction and outcome candidates, L4-only search, and
stale/telemetry isolation. Check: `test:phase-minus1-9-s8`.

## Canonical tax fixture

> I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay
> monthly. What are my options?

Expected decision target: `identify_available_pathways`. Preferred
clarification: `ability_to_pay`. Do not request a full Form 433 package first.

## Full gate

`npm run test:phase-minus1-9`
