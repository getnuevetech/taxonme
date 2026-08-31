import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EXPERIENCE_CANONICAL_NARRATIVE,
  EXPERIENCE_FIXTURE_PACK,
  listExperienceFixtureIds,
  runExperienceFixturePack,
} from "../src/lib/experience";

assert.equal(
  EXPERIENCE_CANONICAL_NARRATIVE,
  "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?",
);
const ids = listExperienceFixtureIds();
assert.equal(ids.length, 8);
assert.ok(ids.includes("exp_canonical_tax_relief_capture"));
assert.ok(ids.includes("exp_neg_premature_financial_schema"));
assert.ok(ids.includes("exp_tax_production_search_l4"));
const results = runExperienceFixturePack();
assert.equal(results.length, EXPERIENCE_FIXTURE_PACK.length);
assert.ok(results.filter((result) => result.kind === "negative").length >= 2);

const experienceSources = [
  "src/lib/experience/fixture-pack.ts",
  "src/lib/experience/negative-lessons.ts",
  "src/lib/experience/outcomes.ts",
  "docs/v5.1/PHASE-MINUS1-9-EXPERIENCE-INSTITUTIONAL-LEARNING.md",
  "docs/v5.1/PHASE-MINUS1-9-S8-EXPERIENCE-FIXTURES.md",
].map((file) => readFileSync(file, "utf8")).join("\n");
assert.doesNotMatch(
  experienceSources,
  /USCIS|VAWA|I-693|medical_exam|Mexico/i,
);

console.log("phase-minus1-9-s8-experience-fixtures-check: ok");
