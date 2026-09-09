/**
 * Package Q — Notice-explainer honesty.
 * Run: npx tsx scripts/phase-package-q-check.ts
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
    extractNoticeCode,
    sanitizeNoticeExplanation,
    isThinNoticeExplanation,
    sparseNoticeNextSteps,
    shouldShowNoticeNextSteps,
    shouldShowNoticeLetterCta,
    NOTICE_RESOLUTION_PLAYBOOK,
  } = await import("../src/lib/ai/notice-honesty");
  const { PROMPT_SUPERSEDES } = await import("../src/lib/ai/v3-prompts");

  assert.equal(extractNoticeCode("Final Notice LT11 dated 2024"), "LT11");
  assert.equal(extractNoticeCode("no code here"), "");

  const unknownPlaybook = {
    notice_type: "",
    certainty: "POSSIBLE",
    plain_english_explanation:
      "You may want a First-Time Abatement and an installment agreement under $50,000.",
    next_steps: [
      { title: "Start Form 9465", description: "Set up a payment plan immediately." },
      { title: "Offer in Compromise", description: "Settle for less." },
    ],
    available_response_categories: [{ title: "Installment agreement" }],
  };
  assert.equal(isThinNoticeExplanation(unknownPlaybook, "blurry scan of a letter"), true);
  const thin = sanitizeNoticeExplanation(unknownPlaybook, "blurry scan of a letter");
  assert.equal(thin.sanitized, true);
  assert.equal(thin.thin, true);
  assert.doesNotMatch(String(thin.result.plain_english_explanation), NOTICE_RESOLUTION_PLAYBOOK);
  assert.deepEqual(thin.result.available_response_categories, []);
  const thinSteps = thin.result.next_steps as { title: string }[];
  assert.ok(thinSteps.some((s) => /Identify the notice code|Keep the notice safe/i.test(s.title)));
  assert.equal(
    thinSteps.some((s) => /9465|Offer in Compromise|installment/i.test(s.title)),
    false,
  );

  const lt11Text =
    "LT11 Final Notice of Intent to Levy. Respond by 2024-06-15. Balance shown $2,879.00.";
  const lt11 = {
    notice_type: "LT11",
    amount: 2879,
    deadline: "2024-06-15",
    certainty: "LIKELY",
    plain_english_explanation:
      "LT11 warns of levy action. You may also pursue an installment agreement under $50,000.",
    next_steps: [
      { title: "Calendar the deadline", description: "Respond by the printed date." },
      { title: "Start installment agreement", description: "File Form 9465 for $50,000 streamlined." },
    ],
  };
  assert.equal(isThinNoticeExplanation(lt11, lt11Text), false);
  const rich = sanitizeNoticeExplanation(lt11, lt11Text);
  assert.doesNotMatch(String(rich.result.plain_english_explanation), /\$\s?50,?000|installment agreement/i);
  const richSteps = rich.result.next_steps as { title: string; description: string }[];
  assert.ok(richSteps.some((s) => /deadline/i.test(s.title)));
  assert.equal(richSteps.some((s) => NOTICE_RESOLUTION_PLAYBOOK.test(`${s.title} ${s.description}`)), false);

  const sparse = sparseNoticeNextSteps({ hasCode: false, hasDeadline: false });
  assert.ok(sparse.length >= 3);

  assert.equal(
    shouldShowNoticeNextSteps({ noticeType: "", status: "explained", stepCount: 2 }),
    false,
  );
  assert.equal(
    shouldShowNoticeNextSteps({
      noticeType: "LT11",
      status: "verification_required",
      stepCount: 2,
    }),
    false,
  );
  assert.equal(
    shouldShowNoticeNextSteps({ noticeType: "LT11", status: "explained", stepCount: 2 }),
    true,
  );
  assert.equal(
    shouldShowNoticeLetterCta({ noticeType: "LT11", status: "explained" }),
    true,
  );
  assert.equal(
    shouldShowNoticeLetterCta({ noticeType: "LT11", status: "verification_required" }),
    false,
  );

  assert.equal(PROMPT_SUPERSEDES["RESP-NOT-ANL-v3"], "RESP-NOT-ANL-v31");
  assert.equal(PROMPT_SUPERSEDES["NOTICE-OVERLAY-v32"], "NOTICE-OVERLAY-v33");
  assert.equal(PROMPT_SUPERSEDES["SCHEMA-NOTICE-v3"], "SCHEMA-NOTICE-v31");

  const orch = readFileSync(join(root, "src/lib/ai/orchestrator.ts"), "utf8");
  assert.match(orch, /sanitizeNoticeExplanation/);
  assert.match(orch, /Package Q/);

  const ui = readFileSync(join(root, "src/app/app/notices/page.tsx"), "utf8");
  assert.match(ui, /shouldShowNoticeNextSteps/);
  assert.match(ui, /shouldShowNoticeLetterCta/);

  const docs = readFileSync(join(root, "src/actions/documents.ts"), "utf8");
  assert.match(docs, /verification_required/);
  assert.match(docs, /!noticeType/);

  assert.match(
    readFileSync(join(root, "src/lib/ai/v3-prompts.ts"), "utf8"),
    /RESP-NOT-ANL-v31/,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-Q-NOTICE-EXPLAINER.md"), "utf8"),
    /Package Q/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*Q\*\*.*Notice|notice-explainer/i,
  );

  console.log("phase-package-q-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
