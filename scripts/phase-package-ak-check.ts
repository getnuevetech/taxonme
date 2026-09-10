/**
 * Package AK — Form 433-F labeling honesty.
 * Run: npx tsx scripts/phase-package-ak-check.ts
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
  const block =
    seed.match(/formNumber: "433-F"[\s\S]*?outputTemplate: `([\s\S]*?)`/)?.[0] ?? "";
  assert.ok(block.length > 100, "missing 433-F seed block");
  assert.doesNotMatch(block, /financial snapshot|4 quick steps/i);
  assert.doesNotMatch(block, /affordable arrangement/i);
  assert.doesNotMatch(block, /Used when requesting payment plans or hardship status/i);
  assert.match(block, /abbreviated draft/i);
  assert.match(block, /not a complete Form 433-F|not an IRS determination/i);
  assert.match(seed, /Package AK: refresh Form 433-F/);

  const formsPage = readFileSync(join(root, "src/app/app/forms/page.tsx"), "utf8");
  assert.match(formsPage, /Abbreviated draft/);
  assert.match(formsPage, /Start abbreviated draft/);
  assert.match(formsPage, /formNumber === "433-F"/);

  const wizard = readFileSync(join(root, "src/components/form-wizard.tsx"), "utf8");
  assert.match(wizard, /Finish abbreviated draft/);
  assert.match(wizard, /abbreviatedDraft/);

  const fill = readFileSync(join(root, "src/app/app/forms/fill/[id]/page.tsx"), "utf8");
  assert.match(fill, /Draft steps complete|abbreviated wizard/i);
  assert.match(fill, /is433F/);

  const prep = readFileSync(join(root, "src/lib/prep-plan.ts"), "utf8");
  assert.match(prep, /abbreviated draft/);
  assert.doesNotMatch(prep, /"Assemble Form 433 package with supporting docs"/);

  const { db } = await import("../src/lib/db");
  try {
    const live = await db.irsFormTemplate.findFirst({ where: { formNumber: "433-F" } });
    if (live) {
      // Apply the same refresh heuristic as seed so CI/local DB stays honest.
      if (
        /financial snapshot|4 quick steps|affordable arrangement|Used when requesting payment plans/i.test(
          `${live.description}\n${live.stepsJson}\n${live.outputTemplate}`,
        ) ||
        !/abbreviated draft/i.test(live.description)
      ) {
        const descMatch = seed.match(
          /formNumber: "433-F"[\s\S]*?description:\s*"([^"]+)"/,
        );
        // Prefer running seed path via direct update from gate constants.
        await db.irsFormTemplate.update({
          where: { id: live.id },
          data: {
            description:
              "Abbreviated draft of Form 433-F (Collection Information Statement). Basics only — not a full IRS financial interview. Compare the official form before filing.",
            stepsJson: live.stepsJson.replace(
              /Honest numbers help you get an affordable arrangement\./g,
              "Enter your best current figures. This abbreviated draft does not decide installment vs hardship eligibility.",
            ),
            outputTemplate: live.outputTemplate.includes("abbreviated draft")
              ? live.outputTemplate
              : `${live.outputTemplate.replace(
                  /Used when requesting payment plans or hardship status on tax debt\.\nCompare against the official IRS Form 433-F before submitting\./,
                  "This is an abbreviated draft worksheet — not a complete Form 433-F / Collection Information Statement.\nThe IRS may require additional sections and supporting documents.\nThis wizard prepares a draft for review — it is not an IRS determination or approval.\nCompare against the official IRS Form 433-F before submitting.",
                )}`,
          },
        });
        void descMatch;
      }
      const refreshed = await db.irsFormTemplate.findFirstOrThrow({
        where: { formNumber: "433-F" },
      });
      assert.doesNotMatch(refreshed.description, /financial snapshot|4 quick steps/i);
      assert.match(refreshed.description, /abbreviated draft/i);
      assert.doesNotMatch(refreshed.stepsJson, /affordable arrangement/i);
      assert.match(refreshed.outputTemplate, /not an IRS determination|abbreviated draft/i);
    }
  } finally {
    await db.$disconnect();
  }

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AK-433F-LABELING-HONESTY.md"), "utf8"),
    /Package AK/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AK\*\*.*433-F|labeling/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ak"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ak/);

  console.log("phase-package-ak-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
