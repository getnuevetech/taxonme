# Wave 7 — Experience / institutional learning

**Status:** shipping  
**Gate:** `npm run test:phase-minus1-9`  
**Charter:** `PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md`

## Goal

Turn TaxOnMe interactions into reusable, de-identified tax reasoning patterns
without learning customer identities or fine-tuning a live model.

## Delivered stack

| Slice | Capability |
| --- | --- |
| L0 | Structured `ExperienceRecord` on conversation turns |
| L1 | De-identification and shared `ExperienceObservation` storage |
| L2 | What-mattered partitions and negative learning |
| L3 | Consultant correction candidates |
| L4 | Authority-checked IRS/state/Tax Court outcome candidates |
| L5 | Admin Pattern Registry and promotion ladder |
| L6 | L4 Production-only Experience Search |
| L7 | Help/harm telemetry, staleness, authority invalidation |
| S8 | Permanent tax fixture pack |

## Locked safety rules

- No live fine-tuning.
- Shared storage learns patterns, not identities.
- Only L4 Production patterns are eligible for Experience Search.
- Current authority outranks every historical pattern.
- Government outcomes are evidence of experience, not law.
- A full Form 433 or complete financial statement request must not displace
  the decision-relevant ability-to-pay question.
