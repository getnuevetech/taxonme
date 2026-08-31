# Wave 2 — Guest continuity + conversion UX

**Status:** Shipped  
**Date:** 2026-08-31  
**Playbook:** ImmigrationOnMe `auth-continue`, `guest`, register/login resume, QA register CTAs

## Purpose

Guests can explore → register/login → resume the same Q&A thread or case without losing work.

## Deliverables

| Item | Path |
| --- | --- |
| Safe `next` paths | `src/lib/auth-continue.ts` |
| Claim + auth-next cookie | `src/lib/guest.ts` |
| Register/login/Google resume | `src/actions/auth.ts`, Google callback |
| Guest `/start/qa` signed-in handoff | `src/app/start/qa/page.tsx` |
| Register CTA with `?next=` | `src/components/qa-chat.tsx` |
| Teal `**emphasis**` for offers | `src/components/assistant-reply.tsx` |

## Check

```bash
npm run test:guest-continuity
```

## Follow-ups

- Wave 5: extend `claimGuestSession` to claim Situations.
- Wave 4: richer Pipeline A monetization footers via conversation access helpers.
