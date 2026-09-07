/**
 * Package K — Case clarify → need-to-know planner.
 * Run: npx tsx scripts/phase-package-k-check.ts
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

const THIN =
  "I owe IRS some money but I am not sure how much and what I need to do.";
const RICH =
  "I owe the IRS for 2022 and 2023, have a CP503, and I am not sure if I can pay monthly. What are my options?";

async function main() {
  const root = process.cwd();
  const {
    runConversationIntelligence,
    askableNow,
    needToKnowClarifyQuestion,
    intelligenceForCase,
    composeAssistantView,
  } = await import("../src/lib/conversation");
  const { canSurfaceResolutionPathways } = await import(
    "../src/lib/conversation/pathway-eligibility"
  );

  assert.equal(canSurfaceResolutionPathways(THIN), false);
  assert.equal(canSurfaceResolutionPathways(RICH), true);

  const thinIntel = runConversationIntelligence({ message: THIN, goal: "what should I do?" });
  const thinAsk = askableNow(thinIntel.need_to_know)[0] || thinIntel.strategy.ask_now[0];
  assert.ok(thinAsk);
  assert.match(thinAsk.question, /transcript|notice/i);
  assert.doesNotMatch(thinAsk.question, /monthly payment|installment|Currently Not Collectible/i);
  assert.doesNotMatch(thinAsk.reason, /installment agreement vs Currently Not Collectible/i);

  const thinNtk = needToKnowClarifyQuestion(thinIntel, []);
  assert.ok(thinNtk);
  assert.match(thinNtk!.key, /^need_to_know:/);
  assert.match(thinNtk!.text, /transcript|notice/i);

  const richIntel = runConversationIntelligence({ message: RICH, goal: "What are my options?" });
  const richAsk = askableNow(richIntel.need_to_know)[0] || richIntel.strategy.ask_now[0];
  assert.ok(richAsk);
  assert.match(richAsk.question, /monthly payment|paying anything/i);

  const fromCase = intelligenceForCase({ situation: THIN, goal: "help" });
  assert.match(
    needToKnowClarifyQuestion(fromCase, [])?.text ?? "",
    /transcript|notice/i,
  );

  // After NTK answered, helper returns null (schema path is for live Case DB).
  assert.equal(needToKnowClarifyQuestion(thinIntel, [thinNtk!.key]), null);

  const view = composeAssistantView(thinIntel, THIN);
  assert.doesNotMatch(JSON.stringify(view), /Form 9465|\$50,?000|Offer in Compromise/i);

  const ltView = composeAssistantView(
    runConversationIntelligence({
      message: "I received an LT11 final notice intent to levy. What does it mean?",
    }),
    "I received an LT11 final notice intent to levy. What does it mean?",
  );
  assert.doesNotMatch(JSON.stringify(ltView), /installment agreement, or another relief path/i);

  const clarifySrc = readFileSync(join(root, "src/lib/clarify.ts"), "utf8");
  assert.match(clarifySrc, /needToKnowClarifyQuestion/);
  assert.match(clarifySrc, /unknownHelpsContract/);
  assert.match(clarifySrc, /intelligenceForCase/);

  const ntkSrc = readFileSync(join(root, "src/lib/conversation/need-to-know.ts"), "utf8");
  assert.match(ntkSrc, /canSurfaceResolutionPathways/);
  assert.match(ntkSrc, /establish_account_position/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-K-NEED-TO-KNOW-CLARIFY.md"), "utf8"),
    /Package K/i,
  );
  assert.match(
    readFileSync(join(root, "src/components/case-clarify.tsx"), "utf8"),
    /question\.reason/,
  );

  console.log("phase-package-k-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
