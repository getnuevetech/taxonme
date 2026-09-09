#!/usr/bin/env tsx
/**
 * Package X — CLI for force overwrite ConversationIntelligence re-enrich.
 * Usage:
 *   npx tsx scripts/intelligence-force-reenrich.ts --kind case --dry-run
 *   npx tsx scripts/intelligence-force-reenrich.ts --kind situation --force --apply --limit 25
 *   npx tsx scripts/intelligence-force-reenrich.ts --kind qa_thread --force --apply --id <id>
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
  const force = flag("--force");
  const limit = Number(arg("--limit") || "25");
  const entityId = arg("--id");
  const cursor = arg("--cursor");
  const kindRaw = arg("--kind") || "case";
  if (kindRaw !== "case" && kindRaw !== "situation" && kindRaw !== "qa_thread") {
    console.error("Error: --kind must be case, situation, or qa_thread");
    process.exit(1);
  }
  if (apply && !force) {
    console.error("Error: --apply requires --force (overwrite acknowledgment)");
    process.exit(1);
  }

  const {
    forceReenrichIntelligence,
    formatForceReenrichSummary,
  } = await import("../src/lib/admin/intelligence-force-reenrich");

  const result = await forceReenrichIntelligence(kindRaw, {
    dryRun,
    force,
    limit,
    entityId,
    cursor,
  });
  console.log(formatForceReenrichSummary(result));
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
