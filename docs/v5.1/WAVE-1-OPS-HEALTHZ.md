# Wave 1 — Ops parity (healthz + deep readiness)

**Status:** Shipped  
**Date:** 2026-08-31  
**Playbook:** ImmigrationOnMe `src/app/healthz`, `src/app/api/health`, Lightsail notes

## Purpose

Match ImmigrationOnMe deploy/ops reliability on TaxOnMe without changing product lifecycle.

## Deliverables

| Item | Path |
| --- | --- |
| LB liveness | `GET /healthz` → plain `ok` (no DB) |
| Deep readiness | `GET /api/health` → DB + `schemaReady` + optional cron maintenance |
| Caddy example | `deploy/Caddyfile.example` keeps `/healthz` on HTTP |
| Deploy notes | Lightsail LB → HTTP `/healthz` |
| Dashboard harden | `/app` query isolation so one failing query does not white-screen |

## Schema readiness (today)

Required for `schemaReady`: `Case`, `GuestSession`, `EvidenceFact`.  
Forward probes (`situation_table`, `experience_observation`) report `not_yet` until Waves 5 / 7.

## Check

```bash
npm run test:lightsail-healthz
```

## Host note

Point Lightsail (or any LB) health checks at **HTTP** `/healthz` on port 3000 or 80 — not HTTPS, not `/api/health`.
