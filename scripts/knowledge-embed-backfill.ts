#!/usr/bin/env tsx
/**
 * Package U — embed KnowledgeSource rows missing vectors.
 * Usage:
 *   npx tsx scripts/knowledge-embed-backfill.ts --dry-run
 *   npx tsx scripts/knowledge-embed-backfill.ts --apply --limit 50
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
  const limit = Math.min(Math.max(Number(arg("--limit") || "50"), 1), 500);

  const { db } = await import("../src/lib/db");
  const { embedKnowledgeSourceById, parseEmbeddingJson, resolveEmbeddingProvider } =
    await import("../src/lib/ai/embeddings");

  const provider = await resolveEmbeddingProvider();
  if (!provider && apply) {
    console.error("No enabled openai_compatible AiProvider with API key; cannot embed.");
    process.exitCode = 1;
    await db.$disconnect();
    return;
  }

  const rows = await db.knowledgeSource.findMany({
    where: { isActive: true },
    select: { id: true, title: true, embeddingJson: true },
    orderBy: { updatedAt: "asc" },
    take: limit * 4,
  });
  const eligible = rows.filter((r) => !parseEmbeddingJson(r.embeddingJson)).slice(0, limit);
  console.log(
    `Knowledge embed (${dryRun ? "dry-run" : "apply"}): scanned=${rows.length} eligible=${eligible.length} provider=${provider ? provider.model : "none"}`,
  );
  if (dryRun) {
    await db.$disconnect();
    return;
  }
  let written = 0;
  let failed = 0;
  for (const row of eligible) {
    const ok = await embedKnowledgeSourceById(row.id);
    if (ok) written++;
    else {
      failed++;
      console.log(`  fail ${row.id}: ${row.title}`);
    }
  }
  console.log(`written=${written} failed=${failed}`);
  if (failed) process.exitCode = 1;
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
