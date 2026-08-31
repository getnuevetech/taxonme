/**
 * Wave 5 / Phase S5 — customer-facing copy cleanup.
 * Never ask “open a case?”; Situation chrome for options; Case only for agency matters.
 * Run: npx tsx scripts/phase-s5-customer-copy-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

{
  const guide = readFileSync(join(root, "src/lib/guide.ts"), "utf8");
  assert.doesNotMatch(guide, /Want me to start/i);
  assert.doesNotMatch(guide, /Want me to/i);
  assert.ok(guide.includes("Continue with my situation"));
  assert.ok(guide.includes("Track this government case"));
  assert.ok(guide.includes("/app/situations"));
}

{
  const intake = readFileSync(join(root, "src/components/intake-wizard.tsx"), "utf8");
  assert.ok(!intake.includes('name="forceCase"'));
}

{
  const caseAction = readFileSync(join(root, "src/actions/case.ts"), "utf8");
  assert.ok(caseAction.includes("forceCase: false"));
  assert.ok(caseAction.includes("createSituationFromIntelligence"));
}

{
  const cases = readFileSync(join(root, "src/app/app/cases/page.tsx"), "utf8");
  assert.ok(cases.includes("/app/situations"));
  assert.match(cases, /agency/i);
}

{
  const sit = readFileSync(join(root, "src/components/situation-workspace-view.tsx"), "utf8");
  assert.ok(sit.includes("Your Tax Situation"));
  assert.doesNotMatch(sit, /Want me to/i);
}

{
  const doc = readFileSync(join(root, "docs/v5.1/WAVE-5-SITUATION-PREP-PLAN.md"), "utf8");
  assert.ok(/S5|customer.?facing copy|silent/i.test(doc));
}

// Never surface application/pipeline version labels to customers, guests, or consultants.
{
  const noProductVersion = /\b(?:v3\.1|v3\.2|V5\.1|AI v3)\b/;
  const noInternalWave = /Wave\s+[0-9]+/;
  const resultPage = readFileSync(join(root, "src/app/start/result/page.tsx"), "utf8");
  assert.ok(resultPage.includes("The full review is still checking"));
  assert.doesNotMatch(resultPage, noProductVersion);
  assert.doesNotMatch(resultPage, /full v3\.1 review/);

  for (const rel of [
    "src/app/admin/diagnostics/page.tsx",
    "src/app/admin/ai-readiness/page.tsx",
    "src/components/case-analysis-view.tsx",
    "src/lib/guide.ts",
    "src/components/intake-wizard.tsx",
    "src/components/situation-workspace-view.tsx",
  ]) {
    const text = readFileSync(join(root, rel), "utf8");
    assert.doesNotMatch(text, noProductVersion, `${rel} must not mention product versions`);
  }

  for (const rel of ["src/actions/experience-correction.ts", "src/actions/experience-outcome.ts"]) {
    const text = readFileSync(join(root, rel), "utf8");
    assert.doesNotMatch(text, noInternalWave, `${rel} must not mention internal wave labels`);
  }

  const globalRules = readFileSync(join(root, "src/lib/ai/v3-prompts.ts"), "utf8");
  assert.ok(globalRules.includes("application/pipeline version labels"));
  assert.ok(globalRules.includes("consultant-facing output"));
}

console.log("phase-s5-customer-copy-check: ok");
