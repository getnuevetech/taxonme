/**
 * Package N — Case ConversationIntelligence persistence.
 * Run: npx tsx scripts/phase-package-n-check.ts
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
    runConversationIntelligence,
    resolveCaseIntelligenceJson,
    intelligenceForCase,
    summarizeForCase,
  } = await import("../src/lib/conversation");

  const msg =
    "I received a CP504 levy notice for tax year 2022 and need to know what to do next.";
  const intel = runConversationIntelligence({ message: msg, goal: msg });
  const caseJson = JSON.stringify(intel);
  const sitOnly = JSON.stringify(
    runConversationIntelligence({
      message: "Different situation narrative for Situation-only fallback.",
      goal: "options",
    }),
  );

  assert.equal(
    resolveCaseIntelligenceJson({
      caseIntelligenceJson: caseJson,
      situationIntelligenceJson: sitOnly,
    }),
    caseJson,
  );
  assert.equal(
    resolveCaseIntelligenceJson({
      caseIntelligenceJson: "{}",
      situationIntelligenceJson: sitOnly,
    }),
    sitOnly,
  );
  assert.equal(
    resolveCaseIntelligenceJson({
      caseIntelligenceJson: null,
      situationIntelligenceJson: null,
    }),
    null,
  );

  const fromCase = intelligenceForCase({
    situation: msg,
    goal: msg,
    intelligenceJson: caseJson,
    situationIntelligenceJson: sitOnly,
  });
  assert.equal(fromCase.question_contract.decision_target, intel.question_contract.decision_target);

  const fromSit = intelligenceForCase({
    situation: msg,
    goal: msg,
    intelligenceJson: "{}",
    situationIntelligenceJson: sitOnly,
  });
  assert.doesNotMatch(fromSit.question_contract.interpreted_question, /CP504/);

  const summary = summarizeForCase({
    situation: msg,
    goal: msg,
    intelligenceJson: caseJson,
  });
  assert.equal(summary.source, "stored");

  const recomputed = summarizeForCase({
    situation: msg,
    goal: msg,
    intelligenceJson: null,
    situationIntelligenceJson: null,
  });
  assert.equal(recomputed.source, "recomputed");

  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  assert.match(schema, /model Case[\s\S]*intelligenceJson/);

  const migration = readFileSync(
    join(root, "prisma/migrations/20260907193000_package_n_case_intelligence/migration.sql"),
    "utf8",
  );
  assert.match(migration, /intelligenceJson/);

  const caseActions = readFileSync(join(root, "src/actions/case.ts"), "utf8");
  assert.match(caseActions, /intelligenceJson:\s*JSON\.stringify\(intel\)/);
  assert.match(caseActions, /intelligenceJson,/);

  const clarify = readFileSync(join(root, "src/lib/clarify.ts"), "utf8");
  assert.match(clarify, /c\.intelligenceJson/);
  assert.match(clarify, /situationIntelligenceJson/);

  const lookup = readFileSync(join(root, "src/lib/admin/intelligence-lookup.ts"), "utf8");
  assert.match(lookup, /caseRow\.intelligenceJson/);
  assert.match(lookup, /resolveCaseIntelligenceJson/);

  const adminCase = readFileSync(join(root, "src/app/admin/cases/[id]/page.tsx"), "utf8");
  assert.match(adminCase, /c\.intelligenceJson/);

  const answerFirst = readFileSync(join(root, "src/components/case-answer-first.tsx"), "utf8");
  assert.match(answerFirst, /intelligenceForCase/);
  assert.match(answerFirst, /intelligenceJson/);

  const reclass = readFileSync(join(root, "src/lib/situation-reclassify-apply.ts"), "utf8");
  assert.match(reclass, /Package N/);
  assert.match(reclass, /caseHasIntel/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-N-CASE-INTELLIGENCE-PERSIST.md"), "utf8"),
    /Package N/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*N\*\*.*Case.*intelligence|Case ConversationIntelligence/i,
  );

  console.log("phase-package-n-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
