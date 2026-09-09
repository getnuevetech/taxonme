/**
 * Package R — Admin ConversationIntelligence re-enrich.
 * Run: npx tsx scripts/phase-package-r-check.ts
 */
import Module from "node:module";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const moduleAny = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = moduleAny._load;
moduleAny._load = function (request: unknown, ...args: unknown[]) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};

async function main() {
  const root = process.cwd();
  const { reenrichEntityIntelligence } = await import("../src/lib/admin/intelligence-reenrich");

  const empty = await reenrichEntityIntelligence({ kind: "situation", id: "" });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /Missing entity id/i);

  const reenrichSrc = readFileSync(join(root, "src/lib/admin/intelligence-reenrich.ts"), "utf8");
  assert.match(reenrichSrc, /enrichIntelligenceWithReasoningModel/);
  assert.match(reenrichSrc, /runConversationIntelligence/);
  assert.match(reenrichSrc, /priorContractFromStored/);
  assert.match(reenrichSrc, /parseStoredIntelligence/);
  assert.match(reenrichSrc, /left stored JSON unchanged|unparseable/i);
  assert.match(reenrichSrc, /learningEventJson/);
  assert.match(reenrichSrc, /qa_thread/);
  assert.match(reenrichSrc, /db\.case\.(findUnique|update)/);
  assert.match(reenrichSrc, /return \{ ok: true, kind: "case"/);

  const adminActions = readFileSync(join(root, "src/actions/admin.ts"), "utf8");
  assert.match(adminActions, /reenrichIntelligenceAction/);
  assert.match(adminActions, /requireAdminArea\("admin\.ai"\)/);
  assert.match(adminActions, /reenrichEntityIntelligence/);
  assert.match(adminActions, /revalidatePath\("\/admin\/intelligence"\)/);

  const page = readFileSync(join(root, "src/app/admin/intelligence/page.tsx"), "utf8");
  assert.match(page, /IntelligenceReenrichButton/);
  assert.doesNotMatch(page, /Does not re-run enrichment/);

  const button = readFileSync(
    join(root, "src/components/admin/intelligence-reenrich-button.tsx"),
    "utf8",
  );
  assert.match(button, /reenrichIntelligenceAction/);
  assert.match(button, /Re-enrich/);

  const casePage = readFileSync(join(root, "src/app/admin/cases/[id]/page.tsx"), "utf8");
  assert.match(casePage, /re-enrich Case intel|admin\/intelligence\?q=/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-R-ADMIN-INTELLIGENCE-REENRICH.md"), "utf8"),
    /Package R/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*R\*\*.*re-enrich|Admin.*re-enrich/i,
  );

  const pkg = readFileSync(join(root, "package.json"), "utf8");
  assert.match(pkg, /"test:package-r"/);

  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /test:package-r/);

  console.log("phase-package-r-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
