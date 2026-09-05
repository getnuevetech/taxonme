# Domain map — ImmigrationOnMe ↔ TaxOnMe

TaxOnMe keeps tax language and domain ownership. When porting engines from
ImmigrationOnMe (`getnuevetech/myimmigration`), copy **contracts and behavior**,
not immigration strings, forms, or fixtures.

**Forward (historical):** TaxOnMe → ImmigrationOnMe was the original fork direction.  
**Reverse (this program):** ImmigrationOnMe → TaxOnMe — see
`docs/TAXONME-OPTIMIZATION-EXECUTION-PLAN.md`.

Generic evidence modules may keep shared concepts such as facts, events,
relationships, unknowns, audits, and reconstruction. Domain-specific classifiers,
fact keys, prompts, and customer copy belong under TaxOnMe (`src/domain` when
introduced, otherwise tax-named modules).

## Product boundary

| ImmigrationOnMe | TaxOnMe |
| --- | --- |
| USCIS / EOIR / DOS / ICE-CBP | IRS / state DOR / Tax Court / Collections |
| Applicant / petitioner / beneficiary | Taxpayer / spouse / dependent / responsible party |
| Immigration attorney / accredited rep | CPA / EA / tax attorney / enrolled agent |
| Situation (SIT-) | Tax Situation (open question / pre-filing / unresolved issue) |
| Filing Plan | Prep / filing plan (return or response packet sequence) |
| Case (IMM- / government matter) | Agency Matter (notice, audit, levy, exam, filed return under review) |
| Pipeline A | Tax Q&A / notice explain without opening a matter |
| Pipeline B / V5.1 engine | Full matter analysis (ledger, locks, gate, presentation) |
| USCIS notice / RFE / NOID | IRS/state notice (CP/LT, audit, levy, lien) |
| Receipt / I-797 / case status | Transcript / acknowledgment / e-file conf / notice ID |
| Form wizard (I-130…) | Tax form / installment / response wizard |
| Response letter | Letter to IRS/state |
| USCIS knowledge base | Pubs / IRM / code / state instructions (admin-curated) |
| Pro consultant referral | Tax-pro referral (mutual consent) |
| Experience L4 pattern | De-identified tax outcome/correction pattern |

## Evidence concepts

| ImmigrationOnMe | TaxOnMe |
| --- | --- |
| Receipt number + form type + filing date | Tax year / tax period |
| Case posture (filed, RFE, interview, …) | Tax module / account period state |
| Notice type / decision type | Transcript transaction code / notice code |
| Case status / pending action / fee issue | Account balance / assessment |
| Concurrent filing / derivative / linked receipt | Credit transfer between years |
| Missing filing / response packet | Missing return / missing response |

## Fact key mapping

| ImmigrationOnMe fact key | TaxOnMe fact key |
| --- | --- |
| `case_year` | `tax_year` |
| `receipt_number`, `form_type`, `priority_date` | `tax_period` |
| `case_status`, `pending_action`, `fee_issue` | `balance_due` |
| `response_deadline`, `appointment_date`, `filing_deadline` | `notice_deadline` |
| `notice_type`, `decision_type`, `appointment_type` | `transcript_code` |
| `agency_address`, `filing_location` | `irs_address` |

## Porting rules (TaxOnMe)

1. Keep JSON shapes from ImmigrationOnMe; rewrite prompt examples to IRS/tax.
2. Never ship USCIS / EOIR / I-130 / VAWA / RFE customer copy into TaxOnMe.
3. Do not assume every workspace is a Case/Matter — Question → Situation → Prep Plan → Agency Matter.
4. Evidence claims must trace to a fact, event, knowledge source, or explicit unknown.
5. Suppress clarifying questions only when the evidence ledger already answers them.
6. Stay on TaxOnMe’s Next.js major; do not pin Imm’s Next 15 when porting.
7. Build for **unbounded IRS scenarios** (letters, liabilities, benefits, any user query)—engines + authority retrieval, not static one-scenario answers. See `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`.
