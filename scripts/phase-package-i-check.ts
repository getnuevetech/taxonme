/**
 * Package I — conversation reasoning enrichment.
 * Run: npx tsx scripts/phase-package-i-check.ts
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

async function main() {
  const root = process.cwd();
  const {
    shouldAttemptReasoningEnrichment,
    isAllowedDecisionTarget,
    MODEL_ROLES,
    ROLE_CAPABILITIES,
    REASONING_ENRICH_CONFIDENCE_CEILING,
  } = await import("../src/lib/ai/model-capabilities");
  const {
    runConversationIntelligence,
    enrichIntelligenceWithReasoningModel,
    applyExperienceAskHints,
    applyContractRefine,
    parseContractRefineResponse,
  } = await import("../src/lib/conversation");

  assert.equal(ROLE_CAPABILITIES[MODEL_ROLES.PRIMARY_REASONING].may_refine_contract, true);
  assert.equal(ROLE_CAPABILITIES[MODEL_ROLES.PRIMARY_REASONING].may_invent_document_facts, false);
  assert.equal(shouldAttemptReasoningEnrichment({ routing_confidence: 0.9 }), false);
  assert.equal(
    shouldAttemptReasoningEnrichment({
      routing_confidence: REASONING_ENRICH_CONFIDENCE_CEILING - 0.01,
    }),
    true,
  );
  assert.equal(
    shouldAttemptReasoningEnrichment({ routing_confidence: 0.99, clarify_first_required: true }),
    true,
  );
  assert.equal(isAllowedDecisionTarget("identify_available_pathways"), true);
  assert.equal(isAllowedDecisionTarget("invent_installment_playbook"), false);

  const base = runConversationIntelligence({ message: THIN, goal: "what should I do?" });
  assert.ok(base.strategy.ask_now.length >= 0);

  // Passthrough when no experience + no model attempt.
  const unchanged = await enrichIntelligenceWithReasoningModel(
    base,
    { message: THIN, goal: "what should I do?" },
    { experienceHints: null, attemptModelRefine: false },
  );
  assert.equal(unchanged.question_contract.decision_target, base.question_contract.decision_target);

  // Experience prefer/suppress reorders existing asks only.
  const withAsk = {
    ...base,
    strategy: {
      ...base.strategy,
      ask_now: [
        {
          question: "Which tax year(s) does this balance cover?",
          tier: "critical_now" as const,
          reason: "year specific",
          changes_branch: true,
          branches_affected: ["identify_years"],
        },
        {
          question: "Can you make any monthly payment toward the balance, or is paying anything right now impossible?",
          tier: "critical_now" as const,
          reason: "ability",
          changes_branch: true,
          branches_affected: ["installment_agreement"],
        },
      ],
    },
  };
  const preferred = applyExperienceAskHints(withAsk, {
    prefer_keys: ["ability_to_pay"],
    suppress_keys: [],
    negative_lesson_ids: [],
  });
  assert.match(preferred.strategy.ask_now[0]?.question ?? "", /monthly payment/i);

  const suppressed = applyExperienceAskHints(withAsk, {
    prefer_keys: [],
    suppress_keys: ["ability_to_pay"],
    negative_lesson_ids: [],
  });
  assert.doesNotMatch(suppressed.strategy.ask_now[0]?.question ?? "", /monthly payment/i);

  // Allowlisted refine only.
  const refined = applyContractRefine(base, {
    interpreted_question: "Clarify what the IRS shows as owed and the next evidence step.",
    decision_target: "identify_available_pathways",
  });
  assert.match(refined.question_contract.interpreted_question, /IRS shows/i);

  const rejected = applyContractRefine(base, {
    decision_target: "force_offer_in_compromise",
  });
  assert.equal(rejected.question_contract.decision_target, base.question_contract.decision_target);

  assert.deepEqual(
    parseContractRefineResponse(
      '```json\n{"interpreted_question":"Explain CP2000 mismatches.","decision_target":"explain_document_or_notice"}\n```',
    ),
    {
      interpreted_question: "Explain CP2000 mismatches.",
      decision_target: "explain_document_or_notice",
    },
  );

  // Injectable model refine path.
  const modelEnriched = await enrichIntelligenceWithReasoningModel(
    base,
    { message: THIN },
    {
      experienceHints: { prefer_keys: [], suppress_keys: [], negative_lesson_ids: [] },
      attemptModelRefine: true,
      refineContract: async () => ({
        interpreted_question: "Establish IRS account position before discussing payment options.",
        decision_target: "identify_available_pathways",
      }),
    },
  );
  assert.match(modelEnriched.question_contract.interpreted_question, /account position/i);

  // Fail-closed: refine throws → still returns.
  const failed = await enrichIntelligenceWithReasoningModel(
    base,
    { message: THIN },
    {
      experienceHints: null,
      attemptModelRefine: true,
      refineContract: async () => {
        throw new Error("provider down");
      },
    },
  );
  assert.equal(failed.question_contract.decision_target, base.question_contract.decision_target);

  const intelSrc = readFileSync(join(root, "src/lib/conversation/intelligence.ts"), "utf8");
  assert.match(intelSrc, /searchProductionExperience|applyExperienceAskHints/);
  assert.doesNotMatch(intelSrc, /Wave 4: no-op until TaxOnMe ports model-capabilities/);

  const userSrc = readFileSync(join(root, "src/actions/user.ts"), "utf8");
  assert.match(userSrc, /enrichIntelligenceWithReasoningModel/);
  const caseSrc = readFileSync(join(root, "src/actions/case.ts"), "utf8");
  assert.match(caseSrc, /enrichIntelligenceWithReasoningModel/);

  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-I-REASONING-ENRICH.md"), "utf8"),
    /Package I/i,
  );
  assert.match(
    readFileSync(join(root, "src/lib/ai/model-capabilities.ts"), "utf8"),
    /PRIMARY_REASONING/,
  );

  console.log("phase-package-i-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
