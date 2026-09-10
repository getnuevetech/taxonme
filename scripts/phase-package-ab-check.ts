/**
 * Package AB — Form 9465 PDF / prefill ÷72 honesty.
 * Run: npx tsx scripts/phase-package-ab-check.ts
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
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");

  // Seed map for 9465 must not contain ÷72 auto-fill; still maps monthly_payment.
  const map9465 =
    seed.match(/\/\/ Form 9465[\s\S]*?(?=\n\s*\/\/ Form W-4)/)?.[0] ??
    seed.match(/"9465":\s*\[[\s\S]*?\],\s*\n\s*\/\/ Form W-4/)?.[0] ??
    "";
  assert.ok(map9465.length > 80, "Form 9465 PDF map block missing in seed");
  assert.doesNotMatch(map9465, /\/\s*72/);
  assert.doesNotMatch(map9465, /f1_27/);
  assert.match(map9465, /monthly_payment/);
  assert.match(map9465, /amount_owed - down_payment/);
  assert.match(seed, /Package AB: refresh Form 9465 PDF map/);

  const prefill = readFileSync(join(root, "src/lib/form-prefill.ts"), "utf8");
  assert.doesNotMatch(prefill, /Math\.ceil\(balanceDue\s*\/\s*72\)/);
  assert.doesNotMatch(prefill, /monthly_payment:\s*suggestedMonthly/);
  assert.doesNotMatch(prefill, /Suggested monthly \(illustrative/);
  assert.match(prefill, /do not invent monthly_payment|do not auto-fill from a ÷72/i);

  const pdfForms = readFileSync(join(root, "src/lib/pdf-forms.ts"), "utf8");
  assert.doesNotMatch(pdfForms, /\/ 72"/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AB-9465-PREFILL-HONESTY.md"), "utf8"),
    /Package AB/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AB\*\*.*9465|prefill|÷72/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ab"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ab/);

  const { db } = await import("../src/lib/db");
  try {
    const form = await db.irsFormTemplate.findFirst({ where: { formNumber: "9465" } });
    if (form) {
      // Force stale ÷72 map, then apply Package AB refresh logic.
      const P1 = "topmostSubform[0].Page1[0]";
      const stale = [
        { field: `${P1}.f1_26[0]`, expr: "amount_owed - down_payment" },
        { field: `${P1}.f1_27[0]`, expr: "(amount_owed - down_payment) / 72" },
        { field: `${P1}.f1_28[0]`, source: "monthly_payment", transform: "money" },
      ];
      await db.irsFormTemplate.update({
        where: { id: form.id },
        data: { pdfMapJson: JSON.stringify(stale) },
      });
      const mid = await db.irsFormTemplate.findFirst({ where: { formNumber: "9465" } });
      assert.match(mid!.pdfMapJson, /\/\s*72/);

      const honest = [
        { field: `${P1}.f1_22[0]`, source: "amount_owed", transform: "money" },
        { field: `${P1}.f1_24[0]`, source: "amount_owed", transform: "money" },
        { field: `${P1}.f1_25[0]`, source: "down_payment", transform: "money" },
        { field: `${P1}.f1_26[0]`, expr: "amount_owed - down_payment" },
        { field: `${P1}.f1_28[0]`, source: "monthly_payment", transform: "money" },
        { field: `${P1}.f1_30[0]`, source: "payment_day" },
      ];
      if (/\/\s*72/.test(mid!.pdfMapJson || "")) {
        await db.irsFormTemplate.update({
          where: { id: form.id },
          data: { pdfMapJson: JSON.stringify(honest) },
        });
      }
      const after = await db.irsFormTemplate.findFirst({ where: { formNumber: "9465" } });
      assert.doesNotMatch(after!.pdfMapJson, /\/\s*72/);
      assert.doesNotMatch(after!.pdfMapJson, /f1_27/);
      assert.match(after!.pdfMapJson, /monthly_payment/);
    }
  } finally {
    await db.$disconnect();
  }

  console.log("phase-package-ab-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
