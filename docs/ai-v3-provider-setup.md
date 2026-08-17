# AI v3 Provider Setup Checklist

Provider secrets are stored in the database through Admin -> AI providers. Do not
commit provider API keys to `.env`, `.env.deploy`, Dockerfiles, scripts, docs, or
chat output.

## Required provider checks

For each provider used by v3 pipelines:

1. Add the API key in Admin -> AI providers.
2. Confirm the provider is enabled.
3. Confirm the model name is valid by running the provider connectivity test.
4. Set `dataRetentionProfile` to an approved value, for example:
   - `approved_taxpayer_data`
5. Set `regionProfile` to an approved value, for example:
   - `approved`
   - `approved_us`
6. Set:
   - cost tier
   - timeout
   - structured-output support
   - max context tokens
   - vision/PDF support

The runtime intentionally skips providers whose data-retention or region profile
does not start with `approved`.

## Recommended route coverage

At minimum, production should have approved providers for:

- `reasoning_primary`
- `reasoning_secondary`
- `reasoning_verifier`
- `reasoning_reviewer`
- `document_primary`
- `document_secondary`
- `fast_presenter`
- `guide_primary`

Provider diversity is recommended for independent analyst/extractor roles, but
diversity is not a substitute for evidence, source verification, or reviewer
approval.

## Readiness check

After configuring providers, run:

```bash
npm run ai:v3:rollout-check
```

Readiness may still warn about open human-review items or queued re-analysis
events. Those are operational items, not provider setup failures.
