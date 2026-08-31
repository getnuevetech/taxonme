/**
 * Wave 5 — Situation discovery bridge (list/nav/dashboard).
 * Run: npx tsx scripts/phase-s-situation-discovery-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

{
  const layout = readFileSync(join(root, "src/app/app/layout.tsx"), "utf8");
  assert.ok(layout.includes('href: "/app/situations"') || layout.includes('"/app/situations"'));
  assert.ok(layout.includes("My situations"));
  assert.ok(layout.includes("My cases"));
}

{
  const sitList = readFileSync(join(root, "src/app/app/situations/page.tsx"), "utf8");
  assert.ok(sitList.includes("My situations"));
  assert.ok(sitList.includes("formatSituationNumber"));
  assert.ok(sitList.includes("db.situation.findMany"));
}

{
  const dash = readFileSync(join(root, "src/app/app/page.tsx"), "utf8");
  assert.ok(dash.includes("db.situation") && dash.includes("findMany"), "dashboard must load Situations");
  assert.ok(dash.includes("/app/situations"));
  assert.ok(dash.includes("formatSituationNumber"));
  assert.ok(dash.includes(".catch(") || dash.includes("situationsUnavailable"));
}

{
  const cases = readFileSync(join(root, "src/app/app/cases/page.tsx"), "utf8");
  assert.ok(cases.includes("/app/situations"));
}

{
  const guide = readFileSync(join(root, "src/lib/guide.ts"), "utf8");
  assert.ok(guide.includes('href: "/app/situations"') || guide.includes('"/app/situations"'));
}

{
  const guest = readFileSync(join(root, "src/lib/guest.ts"), "utf8");
  assert.ok(guest.includes("db.situation.updateMany"));
  assert.ok(guest.includes("situationId"));
}

{
  const health = readFileSync(join(root, "src/app/api/health/route.ts"), "utf8");
  assert.ok(health.includes("situation_table"));
  assert.ok(health.includes("db.situation.findFirst"));
}

{
  const doc = readFileSync(join(root, "docs/v5.1/WAVE-5-SITUATION-PREP-PLAN.md"), "utf8");
  assert.ok(/Situation discovery|My situations/i.test(doc));
}

console.log("phase-s-situation-discovery-check: ok");
