/**
 * Package AE — Intake goal-chip honesty.
 * Run: npx tsx scripts/phase-package-ae-check.ts
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
  const {
    INTAKE_GOAL_CHIPS,
    INTAKE_GOAL_CHIP_MECHANISM_RE,
  } = await import("../src/lib/intake-goal-chips");

  assert.ok(INTAKE_GOAL_CHIPS.length >= 4);
  for (const chip of INTAKE_GOAL_CHIPS) {
    assert.doesNotMatch(chip, INTAKE_GOAL_CHIP_MECHANISM_RE, `chip must not be mechanism: ${chip}`);
  }
  assert.ok(INTAKE_GOAL_CHIPS.some((c) => /owe|transcript|letter|years|facts/i.test(c)));
  assert.equal(
    INTAKE_GOAL_CHIPS.some((c) => /payment plan|reduce penalties/i.test(c)),
    false,
  );

  const wizard = readFileSync(join(root, "src/components/intake-wizard.tsx"), "utf8");
  assert.match(wizard, /INTAKE_GOAL_CHIPS/);
  assert.doesNotMatch(wizard, /Set up a payment plan|Reduce penalties/);
  assert.doesNotMatch(
    wizard,
    /\["Catch up on unfiled returns", "Understand an IRS letter", "Set up a payment plan"/,
  );

  const { demoteMechanismGoal } = await import("../src/lib/ai/goal-provenance");
  const preserved = demoteMechanismGoal("Set up a payment plan", "Find out what I owe");
  assert.equal(preserved, "Find out what I owe");

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-AE-INTAKE-GOAL-CHIP-HONESTY.md"), "utf8"),
    /Package AE/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*AE\*\*.*goal-chip|Intake goal/i,
  );
  assert.match(readFileSync(join(root, "package.json"), "utf8"), /"test:package-ae"/);
  assert.match(readFileSync(join(root, ".github/workflows/ci.yml"), "utf8"), /test:package-ae/);

  console.log("phase-package-ae-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
