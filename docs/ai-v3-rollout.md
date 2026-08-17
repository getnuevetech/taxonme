# AI Pipeline v3 Rollout Runbook

This runbook deploys the v3 AI pipeline safely after the code is merged.

## 1. Deploy database migrations

Run the normal production migration command:

```bash
npm run db:migrate
```

This creates the v3 prompt, analysis-version, source-snapshot, human-review,
document-verification, provider-policy, and audit fields.

## 2. Seed v3 configuration

Run:

```bash
npm run db:seed
```

The seed installs/updates:

- v3 prompt registry records
- v3 pipeline stage metadata
- v3 pipeline step prompt IDs/routes/modes
- approved default provider policy metadata
- prompt change-history records when a released prompt body would otherwise be mutated

Released prompt bodies are preserved unless `RESEED_AI_PROMPTS=true` is set intentionally.

## 3. Configure providers

In Admin -> AI providers:

- enter API keys
- verify `dataRetentionProfile` starts with `approved`
- verify `regionProfile` starts with `approved`
- set cost tier, timeout, structured-output support, and context size
- run provider connectivity tests

Unapproved providers are intentionally excluded from taxpayer-data AI calls.

## 4. Check AI readiness

Use Admin -> AI readiness or run:

```bash
npm run ai:v3:rollout-check
```

Readiness must have no blocking errors before production use.

Warnings should be reviewed for:

- no active IRS knowledge sources
- no approved providers with API keys
- open human-review items
- queued or running re-analysis events

## 5. Backfill existing cases

For existing production cases, run:

```bash
npm run ai:v3:backfill
```

This creates initial `CaseAnalysisVersion` and `CasePresentation` snapshots for
legacy cases without changing current customer-visible findings.

## 6. Enable maintenance cron

Ensure the external scheduler calls:

```text
POST /api/cron/maintenance
Authorization: Bearer <CRON_SECRET>
```

Maintenance now processes:

- scheduled messages
- ticket auto-close
- queued v3 re-analysis events
- stale running re-analysis recovery
- case auto-close
- deleted account expunge
- old log purge

## 7. Monitor after rollout

Review:

- Admin -> AI readiness
- Admin -> AI run audit
- Admin -> Human review
- Admin -> Source snapshots
- Admin -> System logs

Operational signals to watch:

- schema failures
- provider policy blocks
- source-missing verifier outputs
- high human-review volume
- re-analysis queue backlog
- token/cost spikes
- stale running events

## 8. Rollback

Rollback is configuration-first:

1. Disable affected pipeline stage/step in Admin -> AI pipelines.
2. Activate previous prompt version in Admin -> AI prompts when available.
3. Disable problematic provider route.
4. Re-run affected cases or leave them queued for maintenance processing.

Code rollback should only be used if configuration rollback cannot restore safe behavior.
