/**
 * Package V — QA + letter playbook honesty.
 * Run: npx tsx scripts/phase-package-v-check.ts
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

const THIN_FIXTURE =
  "I owe IRS some money but I am not sure how much and what I need to do.";

async function main() {
  const root = process.cwd();
  const {
    sanitizeQaAnswer,
    sanitizeLetterDraft,
    isThinDebtQaContext,
    isThinLetterContext,
    hasEstablishedDebtAmount,
    QA_LETTER_RESOLUTION_PLAYBOOK,
    sparseThinDebtQaAnswer,
  } = await import("../src/lib/ai/qa-letter-honesty");
  const { PROMPT_SUPERSEDES } = await import("../src/lib/ai/v3-prompts");

  assert.equal(isThinDebtQaContext({ question: THIN_FIXTURE }), true);
  assert.equal(hasEstablishedDebtAmount("Account Transcript shows balance due of $2,879.00"), true);
  assert.equal(
    isThinDebtQaContext({
      question: "What payment options do I have?",
      caseEvidence: "Account Transcript shows balance due of $2,879.00 for tax year 2023.",
    }),
    false,
  );

  const playbookAnswer =
    "You likely qualify for First-Time Abatement and an installment agreement under $50,000. Consider Offer in Compromise if you cannot pay.";
  const thin = sanitizeQaAnswer(playbookAnswer, { question: THIN_FIXTURE });
  assert.equal(thin.thin, true);
  assert.equal(thin.sanitized, true);
  assert.doesNotMatch(thin.answer, QA_LETTER_RESOLUTION_PLAYBOOK);
  assert.match(thin.answer, /Account Transcript|transcript/i);
  assert.doesNotMatch(sparseThinDebtQaAnswer(), QA_LETTER_RESOLUTION_PLAYBOOK);

  const richKeep = sanitizeQaAnswer(
    "Your Account Transcript shows $2,879. An installment agreement may be available once you confirm eligibility.",
    {
      question: "Can I set up a payment plan?",
      caseEvidence: "Account Transcript shows balance due of $2,879.00.",
    },
  );
  assert.equal(richKeep.thin, false);
  assert.match(richKeep.answer, /installment agreement/i);

  const thinLetterBody = [
    "To Whom It May Concern:",
    "",
    "I request First-Time Abatement and an installment agreement under $50,000, or an Offer in Compromise.",
    "",
    "Sincerely,",
    "[YOUR NAME]",
  ].join("\n");
  assert.equal(isThinLetterContext({ context: THIN_FIXTURE, allowedAmounts: [] }), true);
  const letter = sanitizeLetterDraft(thinLetterBody, {
    context: THIN_FIXTURE,
    caseEvidence: "(no verified documents on file)",
    allowedAmounts: [],
  });
  assert.equal(letter.thin, true);
  assert.equal(letter.sanitized, true);
  assert.doesNotMatch(letter.draft, QA_LETTER_RESOLUTION_PLAYBOOK);

  const richLetter = sanitizeLetterDraft(
    "I request an installment agreement for the $2,879 balance shown on my Account Transcript.",
    {
      context: "CP14 balance due $2,879",
      caseEvidence: "Account Transcript shows balance due of $2,879.00.",
      allowedAmounts: [2879],
    },
  );
  assert.equal(richLetter.thin, false);
  assert.match(richLetter.draft, /installment agreement/i);

  assert.equal(PROMPT_SUPERSEDES["QA-OVERLAY-v32"], "QA-OVERLAY-v33");
  assert.equal(PROMPT_SUPERSEDES["LETTER-OVERLAY-v32"], "LETTER-OVERLAY-v33");
  assert.equal(PROMPT_SUPERSEDES["RESP-AST-v3"], "RESP-AST-v31");
  assert.equal(PROMPT_SUPERSEDES["RESP-LTR-DRAFT-v3"], "RESP-LTR-DRAFT-v31");
  assert.equal(PROMPT_SUPERSEDES["SCHEMA-QA-v3"], "SCHEMA-QA-v31");
  assert.equal(PROMPT_SUPERSEDES["SCHEMA-LETTER-v3"], "SCHEMA-LETTER-v31");

  const prompts = readFileSync(join(root, "src/lib/ai/v3-prompts.ts"), "utf8");
  assert.match(prompts, /QA-OVERLAY-v33/);
  assert.match(prompts, /LETTER-OVERLAY-v33/);
  assert.match(prompts, /promptId: "RESP-AST-v31"/);
  assert.match(prompts, /promptId: "RESP-LTR-DRAFT-v31"/);
  assert.match(prompts, /evidence-proportional honesty/i);

  const orch = readFileSync(join(root, "src/lib/ai/orchestrator.ts"), "utf8");
  assert.match(orch, /sanitizeQaAnswer/);
  assert.match(orch, /sanitizeLetterDraft/);
  assert.match(orch, /Package V/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-V-QA-LETTER-HONESTY.md"), "utf8"),
    /Package V/i,
  );
  assert.match(
    readFileSync(join(root, "docs/v5.1/DYNAMIC-IRS-REASONING-GUIDE.md"), "utf8"),
    /\*\*V\*\*.*QA|letter|playbook/i,
  );

  console.log("phase-package-v-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
