#!/usr/bin/env tsx
/**
 * Package T — CLI for historical Case intelligenceJson backfill.
 * Usage:
 *   npx tsx scripts/case-intelligence-backfill.ts --dry-run
 *   npx tsx scripts/case-intelligence-backfill.ts --apply --limit 50
 *   npx tsx scripts/case-intelligence-backfill.ts --apply --case-id <id>
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
  const caseId = arg("--case-id");
  const cursor = arg("--cursor");

  const {
    backfillEmptyCaseIntelligence,
    formatBackfillSummary,
  } = await import("../src/lib/admin/intelligence-backfill");

  const result = await backfillEmptyCaseIntelligence({
    dryRun,
    limit,
    caseId,
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
