/**
 * Wave 5 / Phase S2 — Situation entity + UI invariants.
 * Run: npx tsx scripts/phase-s2-situation-workspace-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

{
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  assert.ok(schema.includes("model Situation"));
  assert.ok(schema.includes("model PrepPlan"));
  assert.ok(schema.includes("situationId"));
  assert.ok(schema.includes("legacyCaseId"));
  assert.ok(schema.includes("governmentSystem"));
}

{
  const view = readFileSync(join(root, "src/components/situation-workspace-view.tsx"), "utf8");
  assert.ok(view.includes("Your Tax Situation"));
  assert.ok(view.includes("What you asked"));
  assert.ok(view.includes("What this may mean"));
  assert.ok(view.includes("Build my Prep Plan"));
  assert.doesNotMatch(view, /YOUR TAX CASE/i);
  assert.ok(view.includes("not an IRS Case"));
}

{
  const page = readFileSync(join(root, "src/app/app/situations/[id]/page.tsx"), "utf8");
  assert.ok(page.includes("SituationWorkspaceView"));
  const guest = readFileSync(join(root, "src/app/start/situation/page.tsx"), "utf8");
  assert.ok(guest.includes("SituationWorkspaceView"));
}

{
  const sit = readFileSync(join(root, "src/lib/situation.ts"), "utf8");
  assert.ok(sit.includes("SIT-"));
  assert.ok(sit.includes("formatSituationNumber"));
}

{
  const migration = readFileSync(
    join(root, "prisma/migrations/20260831180000_phase_s_situation_prep_plan/migration.sql"),
    "utf8",
  );
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS "Situation"'));
  assert.ok(migration.includes('CREATE TABLE IF NOT EXISTS "PrepPlan"'));
}

console.log("phase-s2-situation-workspace-check: ok");
