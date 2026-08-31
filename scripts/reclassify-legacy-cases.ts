#!/usr/bin/env npx tsx
/**
 * Reclassify legacy Case rows that are really Situations.
 * Dry-run by default. Pass --apply to write.
 */
import { applyLegacyCaseReclassification } from "../src/lib/situation-reclassify-apply";

async function main() {
  const apply = process.argv.includes("--apply");
  const result = await applyLegacyCaseReclassification({ dryRun: !apply, limit: 1000 });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned: result.scanned,
        kept: result.kept,
        reclassified: result.reclassified,
        sample: result.decisions.slice(0, 10),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
