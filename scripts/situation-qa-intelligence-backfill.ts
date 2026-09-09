#!/usr/bin/env tsx
/**
 * Package W — CLI for empty Situation / QaThread intelligenceJson backfill.
 * Usage:
 *   npx tsx scripts/situation-qa-intelligence-backfill.ts --kind qa_thread --dry-run
 *   npx tsx scripts/situation-qa-intelligence-backfill.ts --kind situation --apply --limit 50
 *   npx tsx scripts/situation-qa-intelligence-backfill.ts --kind qa_thread --apply --id <id>
 */
import Module from "node:module";

const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

function flag(name: string): boolean {
  return process.argv.includes(name);
}
function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const apply = flag("--apply");
  const dryRun = flag("--dry-run") || !apply;
  const limit = Number(arg("--limit") || "50");
  const entityId = arg("--id");
  const cursor = arg("--cursor");
  const kindRaw = arg("--kind") || "qa_thread";
  if (kindRaw !== "situation" && kindRaw !== "qa_thread") {
    console.error("Error: --kind must be situation or qa_thread");
    process.exit(1);
  }

  const {
    backfillEmptyIntelligence,
    formatBackfillSummary,
  } = await import("../src/lib/admin/intelligence-backfill");

  const result = await backfillEmptyIntelligence(kindRaw, {
    dryRun,
    limit,
    entityId,
    cursor,
  });
  console.log(formatBackfillSummary(result));
  if (result.failures.length) {
    for (const failure of result.failures.slice(0, 20)) {
      console.log(`  fail ${failure.id}: ${failure.error}`);
    }
  }
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
