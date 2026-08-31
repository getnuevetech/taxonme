/**
 * Wave 3a — Free / Plus / Pro forms matrix (Prep Plan key seeded for later).
 * Run: npx tsx scripts/phase-billing-tier-matrix-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_KEYS } from "../src/lib/constants";
import { PUBLIC_PLAN_DESCRIPTIONS } from "../src/lib/plan-public";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

{
  assert.equal(FEATURE_KEYS.PREP_PLAN_BUILD, "prep_plan.build");
  assert.equal(FEATURE_KEYS.FORMS, "forms.wizard");
  assert.equal(FEATURE_KEYS.FORMS_DOWNLOAD, "forms.download");
}

{
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.free, /before you file/i);
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.free, /Prep Plan|form wizard/i);
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.plus, /have not filed yet/i);
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.plus, /capp?ed|Prep Plan|form/i);
  assert.match(PUBLIC_PLAN_DESCRIPTIONS.pro, /Unlimited|unlimited/i);
}

{
  const quotas = read("src/lib/billing-quotas.ts");
  assert.ok(quotas.includes("getPrepPlanQuota"));
  assert.ok(quotas.includes("getFormWizardQuota"));
  assert.ok(quotas.includes("getFormDownloadQuota"));
  assert.ok(quotas.includes("FEATURE_KEYS.PREP_PLAN_BUILD"));
}

{
  const forms = read("src/actions/forms.ts");
  assert.ok(forms.includes("getFormWizardQuota"));
  assert.ok(forms.includes("forms_limit") || forms.includes("overLimit"));
  assert.ok(forms.includes("FEATURE_KEYS.FORMS"));
}

{
  const download = read("src/app/api/forms/[id]/download/route.ts");
  assert.ok(download.includes("getFormDownloadQuota"));
}

{
  const seed = read("prisma/seed.ts");
  assert.ok(seed.includes('"prep_plan.build"'));
  assert.ok(seed.includes("billingMatrix") || seed.includes("Phase Billing") || seed.includes("Wave 3a"));
  assert.match(seed, /prep_plan\.build[\s\S]*limit:\s*2/);
  assert.match(seed, /forms\.wizard[\s\S]*limit:\s*2/);
  assert.match(seed, /forms\.download[\s\S]*limit:\s*1/);
}

{
  const doc = read("docs/v5.1/WAVE-3A-BILLING-FORMS-MATRIX.md");
  assert.ok(doc.includes("prep_plan.build"));
  assert.ok(doc.includes("test:phase-billing") || doc.includes("phase-billing-tier-matrix-check"));
}

console.log("phase-billing-tier-matrix-check: ok");
