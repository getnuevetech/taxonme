# Package AN — Ability-to-pay vs 433 depth labeling honesty

**Guide:** `docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md`  
**Depends on:** Package AK (433-F abbreviated draft); Package S ability-to-pay ask. Does not build a CIS interview.

## Locks

1. Forms page subtitle must **not** say “assemble the real form” unqualified — draft / official-compare language; acknowledge 433-F abbreviated at page level.
2. Homepage feature + stats must **not** claim quiz → “completed standard form” for all forms without a 433-F abbreviated caveat.
3. CNC resolution branch must **not** say “proving financial hardship” as the first gate — ability-to-pay / allowable living expenses; full Form 433 / CIS only when the IRS requests that depth.
4. Keep AK 433-F badge/CTA/wizard/prep-plan abbreviated-draft locks; do not add wizard fields.
5. Do not change `canSurfaceResolutionPathways` or Package S ask preference.
6. Charter + `npm run test:package-an` + CI; guide row **AN**.

## Non-goals

- Full Form 433 / CIS interview or new wizard fields
- 433-A / 433-B wizards
- Mass FAQ / Y playbook gate reopen
- Fallback/Case agree–disagree _(→ Package AO)_
- CP501/CP504 composer leftover _(→ Package AP)_
- Changing need-to-know ask order

## Check

```bash
npm run test:package-an
```
