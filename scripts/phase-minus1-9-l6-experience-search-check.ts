import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EXPERIENCE_SEARCH_PRECEDENCE,
  TAX_RELIEF_SCHEMA_NEGATIVE_LESSON,
  assertAllProductionLevel,
  formatExperienceSearchBlock,
  productionPatternAskHints,
  rankProductionPatterns,
  type AnonymizedExperienceRecord,
} from "../src/lib/experience";

function pattern(
  over: Partial<AnonymizedExperienceRecord> = {},
): AnonymizedExperienceRecord {
  return {
    schema_version: "l1_anon",
    workspace: "existing_case",
    decision_target: "identify_available_pathways",
    current_scope: "pre-filing tax options",
    facts_considered: ["balance_due", "collection_notice"],
    decision_changing_facts: ["ability_to_pay"],
    facts_not_needed_yet: ["full_form_433_package"],
    facts_discarded: ["full_form_433_package"],
    pathways_considered: ["installment_agreement"],
    clarification_key: "ability_to_pay",
    clarification_reason_key: "changes_relief_pathway",
    clarifications_suppressed: ["full_form_433_package"],
    document_kinds: [],
    authority_ids: [],
    answer_changed_after_clarification: false,
    has_model_correction: false,
    has_reviewer_correction: true,
    outcome_kind: null,
    response_mode: "answer_then_targeted_question",
    invokes_case_engine: false,
    existing_government_case: true,
    interaction_intent: "personal_question",
    negative_lesson_ids: [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id],
    negative_learning: [],
    capture_enrichment: "l2",
    source_digest: "tax_search_1",
    promotion_level: 4,
    ...over,
  };
}

assert.match(EXPERIENCE_SEARCH_PRECEDENCE, /CURRENT AUTHORITY/);
assert.throws(() =>
  assertAllProductionLevel([pattern({ promotion_level: 3 })]),
);
const hits = rankProductionPatterns([pattern()], {
  decisionTarget: "identify_available_pathways",
  workspace: "existing_case",
  factKeys: ["ability_to_pay"],
  pathways: ["installment_agreement"],
  negativeLessonIds: [TAX_RELIEF_SCHEMA_NEGATIVE_LESSON.id],
});
assert.equal(hits.length, 1);
const block = formatExperienceSearchBlock(hits);
assert.match(block, /VALIDATED PRODUCTION PATTERNS/);
assert.match(block, /full_form_433_package/);
const hints = productionPatternAskHints(hits);
assert.ok(hints.suppress_keys.includes("full_form_433_package"));
assert.ok(hints.prefer_keys.includes("ability_to_pay"));
const orchestrator = readFileSync("src/lib/ai/orchestrator.ts", "utf8");
assert.match(orchestrator, /buildExperienceSearchBlock/);
assert.match(orchestrator, /experience_patterns/);
assert.match(
  readFileSync("src/lib/experience/publish.ts", "utf8"),
  /minPromotionLevel: 4/,
);

console.log("phase-minus1-9-l6-experience-search-check: ok");
