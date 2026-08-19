import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAGE_KEYS, STEP_ROLES } from "../src/lib/constants";
import { validateAiJson } from "../src/lib/ai/validation";
import { classifyInformationCondition, conceptsConflict, isMaterialDifference, normalizeActionPurpose, normalizeConcept } from "../src/lib/case-semantics";
import { buildReanalysisIdempotencyKey, normalizeReanalysisPipelines, pipelinesForMaterialEvent } from "../src/lib/reanalysis-policy";
import { AI_DIAGNOSTIC_COUNTERS } from "../src/lib/ai/diagnostics-labels";
import { classifyDocument } from "../src/lib/evidence/classify";
import { compileDocumentEvents, compileDocumentFacts } from "../src/lib/evidence/facts";
import { countTransactionRowCandidates, parseTranscript } from "../src/lib/evidence/transcript";
import { resolveQuestionFromFacts, resolveUnknownTextFromFacts } from "../src/lib/evidence/unknowns";
import { DOCUMENT_TYPES, FACT_KEYS, PROVENANCE } from "../src/lib/evidence/types";
import { EXTRACTION_SCHEMA_VERSION, countPages, extractorSignature, isExtractionCacheValid } from "../src/lib/evidence/extraction-cache";
import { analyzeEvidenceRelationships } from "../src/lib/evidence/reconcile-core";
import { amountsEqual, reconcileRefundArithmetic } from "../src/lib/evidence/calculations";
import { evaluateAiV3Readiness } from "../src/lib/ai/readiness-core";
import { redactSensitiveText } from "../src/lib/ai/privacy";
import { DOMAIN_RULES_PROMPT_ID, RESPONSIBILITY_PROMPTS, V3_PIPELINE_BLUEPRINT, V3_PROMPT_RECORDS } from "../src/lib/ai/v3-prompts";

function promptBody(promptId: string): string {
  const prompt = RESPONSIBILITY_PROMPTS.find((p) => p.promptId === promptId);
  assert.ok(prompt, `missing prompt ${promptId}`);
  return prompt.body.toLowerCase();
}

function stageRoles(stageKey: string): string[] {
  const stage = V3_PIPELINE_BLUEPRINT.find((p) => p.key === stageKey);
  assert.ok(stage, `missing stage ${stageKey}`);
  return stage.steps.map((s) => s.role);
}

const domainRules = V3_PROMPT_RECORDS.find((p) => p.promptId === DOMAIN_RULES_PROMPT_ID);
assert.ok(domainRules, "v3.1 domain rules prompt must exist");
assert.match(domainRules.body.toLowerCase(), /canonical case state/);
assert.match(domainRules.body.toLowerCase(), /case-agnostic/);

const goalA = normalizeConcept("I want to be debt free.");
const goalB = normalizeConcept("I want to resolve the IRS debt.");
assert.equal(goalA.normalized_category, "IRS_DEBT_RESOLUTION");
assert.equal(goalB.normalized_category, "IRS_DEBT_RESOLUTION");
assert.equal(conceptsConflict(goalA, goalB), false, "semantic equivalents must not conflict");
assert.equal(classifyInformationCondition({ exists: false, verified: false }), "MISSING_INFORMATION");
assert.equal(classifyInformationCondition({ exists: true, verified: false }), "UNVERIFIED_INFORMATION");
assert.equal(classifyInformationCondition({ exists: true, verified: true, evidenceValues: [5000, 2879] }), "SOURCE_CONFLICT");
assert.equal(classifyInformationCondition({ exists: true, verified: true, modelValues: ["possible", "not supported"] }), "MODEL_DISAGREEMENT");
assert.equal(isMaterialDifference("deadline"), true);
assert.equal(isMaterialDifference("wording style"), false);
assert.equal(normalizeActionPurpose("Review IRS notice and identify notice number"), "VERIFY_NOTICE");
assert.equal(normalizeActionPurpose("Confirm notice details"), "VERIFY_NOTICE");
assert.deepEqual(pipelinesForMaterialEvent("document_added"), ["document", "situation", "presenter"]);
assert.deepEqual(pipelinesForMaterialEvent("professional_confirmed_fact"), ["situation", "presenter"]);
assert.deepEqual(normalizeReanalysisPipelines(["presenter", "situation", "bogus", "presenter"]), ["situation", "presenter"]);
assert.deepEqual(normalizeReanalysisPipelines(["bogus"]), ["summary", "goal", "document", "situation", "presenter"]);
assert.equal(
  buildReanalysisIdempotencyKey({
    caseId: "case_123",
    trigger: "document_added",
    pipelines: ["document", "situation", "presenter"],
    materialKey: "doc_hash",
  }),
  buildReanalysisIdempotencyKey({
    caseId: "case_123",
    trigger: "document_added",
    pipelines: ["presenter", "document", "situation"],
    materialKey: "doc_hash",
  }),
);
for (const counter of ["caseAnalysisCycles", "pipelineRuns", "modelCalls", "failedModelCalls", "retryLogs", "fallbackCalls", "cacheHits"]) {
  assert.ok(AI_DIAGNOSTIC_COUNTERS.includes(counter as (typeof AI_DIAGNOSTIC_COUNTERS)[number]), `missing diagnostics counter ${counter}`);
}
const emptyReadiness = evaluateAiV3Readiness({
  prompts: [],
  stages: [],
  providers: [],
  knowledgeCount: 0,
  openReviewCount: 2,
  queuedEvents: 3,
  runningEvents: 4,
});
assert.equal(emptyReadiness.metrics.openHumanReviews, 2);
assert.equal(emptyReadiness.metrics.queuedReanalysisEvents, 3);
assert.equal(emptyReadiness.metrics.runningReanalysisEvents, 4);

// v3.2 evidence layer: documents must be classified, read, and used before the
// customer is asked anything.
const transcriptText = `ACCOUNT TRANSCRIPT
TAX PERIOD ENDING: Dec. 31, 2023
ACCOUNT BALANCE: 2,879.00
AS OF: Mar. 10, 2026
150 Tax return filed 04-15-2024 $5,000.00
806 W-2 withholding 04-15-2024 -$7,879.00
826 Credit transferred out 05-01-2024 -$2,620.07
846 Refund issued 05-10-2024 -$427.93
570 Additional account action pending 05-01-2024 $0.00`;

const transcriptParsed = parseTranscript(transcriptText);
assert.equal(transcriptParsed.accountBalance, 2879);
assert.equal(transcriptParsed.refundIssued?.amount, -427.93);
assert.equal(transcriptParsed.offsets.length, 1);
assert.equal(transcriptParsed.hold, true);
assert.deepEqual(transcriptParsed.taxPeriods, ["2023"]);
assert.ok(countTransactionRowCandidates(transcriptText) >= transcriptParsed.transactions.length);

const transcriptClass = classifyDocument({ fileName: "acct.pdf", text: transcriptText });
assert.equal(transcriptClass.documentType, DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT);
const noticeClass = classifyDocument({ fileName: "letter.pdf", text: "Internal Revenue Service Notice CP2000 notice date March 1, 2026" });
assert.equal(noticeClass.documentType, DOCUMENT_TYPES.IRS_NOTICE);
const unknownClass = classifyDocument({ fileName: "scan.pdf", text: "unreadable content" });
assert.equal(unknownClass.documentType, DOCUMENT_TYPES.UNKNOWN_TAX_DOCUMENT, "unclassifiable tax documents must not be mislabelled");

const compiledFacts = compileDocumentFacts({ documentId: "DOC-1", documentType: transcriptClass.documentType, text: transcriptText, taxPeriods: transcriptClass.taxPeriods });
const balanceFact = compiledFacts.find((f) => f.factKey === FACT_KEYS.ACCOUNT_BALANCE);
assert.equal(balanceFact?.valueNumber, 2879);
assert.equal(balanceFact?.provenance, PROVENANCE.DOCUMENT_EXTRACTED);
assert.equal(balanceFact?.taxPeriod, "2023");
assert.ok(compiledFacts.some((f) => f.factKey === FACT_KEYS.REFUND_ISSUED));
assert.ok(compiledFacts.some((f) => f.factKey === FACT_KEYS.CREDIT_TRANSFER));

const compiledEvents = compileDocumentEvents({ documentId: "DOC-1", documentType: transcriptClass.documentType, text: transcriptText });
assert.ok(compiledEvents.some((e) => e.eventType === "REFUND_ISSUED"));
assert.ok(compiledEvents.some((e) => e.eventType === "CREDIT_TRANSFERRED_OUT"));

// Existing evidence must retire the question instead of asking the customer.
const ledger = compiledFacts.map((fact, index) => ({
  id: `fact-${index}`,
  factKey: fact.factKey,
  provenance: fact.provenance,
  valueText: fact.valueText ?? "",
  valueNumber: fact.valueNumber ?? null,
  taxPeriod: fact.taxPeriod ?? "",
}));
const balanceQuestion = resolveQuestionFromFacts("balance_amount", ledger);
assert.equal(balanceQuestion.suppressed, true, "balance question must be suppressed when a transcript states the balance");
assert.ok(balanceQuestion.supportingFactIds.length > 0);
assert.equal(resolveQuestionFromFacts("have_transcript", ledger).suppressed, true);
assert.equal(resolveUnknownTextFromFacts("Exact IRS proposed balance", ledger).suppressed, true);
assert.equal(resolveQuestionFromFacts("balance_amount", []).suppressed, false);
// The customer's own words are not evidence for a document-answerable question.
assert.equal(
  resolveQuestionFromFacts("balance_amount", [{ id: "u1", factKey: FACT_KEYS.ACCOUNT_BALANCE, provenance: PROVENANCE.USER_REPORTED, valueNumber: 5000 }]).suppressed,
  false,
);

// Verified extraction is reusable, and only while the extractor lineup holds.
const lineup = [
  { role: "extractor_a", promptId: "RESP-DOC-A-v3", provider: { name: "Provider A", model: "model-a" } },
  { role: "extractor_b", promptId: "RESP-DOC-B-v3", provider: { name: "Provider B", model: "model-b" } },
];
const signature = extractorSignature(lineup);
assert.equal(signature, extractorSignature([...lineup].reverse()), "signature must not depend on step ordering");
assert.notEqual(signature, extractorSignature([{ ...lineup[0], provider: { name: "Provider C", model: "model-c" } }, lineup[1]]));

const cachedDoc = {
  contentHash: "hash",
  extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
  extractorVersionsJson: JSON.stringify({ signature }),
  verificationStatus: "verified",
  processingStatus: "complete",
};
assert.equal(isExtractionCacheValid(cachedDoc, signature), true);
assert.equal(isExtractionCacheValid({ ...cachedDoc, extractorVersionsJson: "{}" }, signature), false, "changed extractors must invalidate the cache");
assert.equal(isExtractionCacheValid({ ...cachedDoc, extractionSchemaVersion: "3.1" }, signature), false, "schema changes must invalidate the cache");
assert.equal(isExtractionCacheValid({ ...cachedDoc, processingStatus: "failed" }, signature), false, "failed processing is never a cache hit");
assert.equal(isExtractionCacheValid({ ...cachedDoc, contentHash: "" }, signature), false);

// A document that declares more pages than we read is partial, not complete.
assert.deepEqual(countPages("Page 1 of 3\nfirst page text"), { expected: 3, processed: 1 });
assert.deepEqual(countPages(""), { expected: 0, processed: 0 });
assert.equal(countPages("single page of text").expected, 1);

// Refund arithmetic is settled by calculation, not by a model's opinion.
const refundMath = reconcileRefundArithmetic({ overpayment: 3048, transfersOut: 2620.07, refundIssued: 427.93 });
assert.equal(refundMath.balanced, true, "overpayment - transfers must reconcile to the refund issued");
assert.equal(reconcileRefundArithmetic({ overpayment: 3048, transfersOut: 2620.07, refundIssued: 500 }).balanced, false);
assert.equal(amountsEqual(427.93, 427.934), true, "cent-level rounding must not break reconciliation");

// A credit leaving one tax period and arriving in another is one relationship.
const crossYear = analyzeEvidenceRelationships(
  [
    { id: "ev-out", taxPeriod: "2024", eventType: "CREDIT_TRANSFERRED_OUT", amount: -2620.07, eventDate: new Date("2024-05-01") },
    { id: "ev-in", taxPeriod: "2023", eventType: "CREDIT_TRANSFERRED_IN", amount: 2620.07, eventDate: new Date("2024-05-01") },
  ],
  [],
);
const transferRelationship = crossYear.relationships.find((r) => r.relationshipType === "CROSS_PERIOD_TRANSFER");
assert.ok(transferRelationship, "a matching cross-period transfer must be identified");
assert.equal(transferRelationship?.status, "CONFIRMED");
assert.equal(transferRelationship?.fromTaxPeriod, "2024");
assert.equal(transferRelationship?.toTaxPeriod, "2023");

// An unmatched transfer stays open rather than being invented into a match.
const unmatchedTransfer = analyzeEvidenceRelationships(
  [{ id: "ev-out", taxPeriod: "2024", eventType: "CREDIT_TRANSFERRED_OUT", amount: -900, eventDate: null }],
  [],
);
assert.equal(unmatchedTransfer.relationships[0].relationshipType, "CREDIT_TRANSFERRED_OUT_UNMATCHED");
assert.equal(unmatchedTransfer.relationships[0].status, "POSSIBLE");

// An older notice amount and a newer transcript amount are sequential states.
const timeline = analyzeEvidenceRelationships(
  [],
  [
    { id: "old", factKey: FACT_KEYS.ACCOUNT_BALANCE, taxPeriod: "2023", valueNumber: 5000, effectiveDate: new Date("2025-01-01"), provenance: PROVENANCE.DOCUMENT_EXTRACTED, documentId: "doc-notice" },
    { id: "new", factKey: FACT_KEYS.ACCOUNT_BALANCE, taxPeriod: "2023", valueNumber: 2879, effectiveDate: new Date("2026-03-10"), provenance: PROVENANCE.DOCUMENT_EXTRACTED, documentId: "doc-transcript" },
  ],
);
assert.deepEqual(timeline.supersededFactIds, ["old"], "the earlier balance must become history, not a conflict");
assert.equal(timeline.currentBalanceByPeriod["2023"].value, 2879);
const supersededRelationship = timeline.relationships.find((r) => r.relationshipType === "BALANCE_SUPERSEDED");
assert.equal(supersededRelationship?.status, "CONFIRMED");
assert.doesNotMatch(String(supersededRelationship?.description), /conflict(?!ing figures)/i);

// Appendix C/H: user belief must not become confirmed IRS fact.
assert.match(promptBody("RESP-FACT-v3"), /belief/);
assert.match(promptBody("RESP-FACT-v3"), /user_reported/);
assert.match(promptBody("RESP-FACT-v3"), /do not solve/);

// Goal wording must not directly become one remedy.
assert.match(promptBody("RESP-GOAL-INT-v3"), /remove my debt/);
assert.match(promptBody("RESP-GOAL-INT-v3"), /not automatically/);

// Extractor A/B independent passes plus reconciler/reviewer.
const doc = V3_PIPELINE_BLUEPRINT.find((p) => p.key === STAGE_KEYS.DOCUMENT)!;
assert.equal(doc.steps.find((s) => s.role === STEP_ROLES.EXTRACTOR_A)?.mode, "parallel");
assert.equal(doc.steps.find((s) => s.role === STEP_ROLES.EXTRACTOR_B)?.mode, "parallel");
assert.ok(doc.steps.some((s) => s.role === STEP_ROLES.RECONCILER));
assert.ok(doc.steps.some((s) => s.role === STEP_ROLES.REVIEWER && s.isConditional));
assert.match(promptBody("RESP-REC-v3"), /never average/);

// Missing source must block material tax conclusions.
assert.match(promptBody("RESP-ANL-v3"), /do not manufacture/);
assert.match(promptBody("RESP-SRC-v3"), /source_missing/);
assert.match(promptBody("RESP-REV-v3"), /downgrade/);

// Reviewer controls presentation.
assert.deepEqual(stageRoles(STAGE_KEYS.SITUATION).slice(-3), [
  STEP_ROLES.SOURCE_VERIFIER,
  STEP_ROLES.SKEPTIC,
  STEP_ROLES.REVIEWER,
]);
assert.deepEqual(stageRoles(STAGE_KEYS.PRESENTER), [STEP_ROLES.PRESENTER]);
assert.equal(validateAiJson(STAGE_KEYS.PRESENTER, { finding_card: { headline: "2024 refund difference identified" }, what_we_found: [] }).ok, true);
assert.equal(validateAiJson(STAGE_KEYS.PRESENTER, { invented_deadline: "tomorrow" }).ok, false);

// Case Guide must capture new facts and request re-analysis.
assert.match(promptBody("RESP-CASE-v3"), /requires_reanalysis=true/);
assert.equal(validateAiJson(STAGE_KEYS.GUIDE, { answer: "I captured that.", new_material_fact_detected: true, captured_fact: "New CP2000 notice", requires_reanalysis: true }).ok, true);
const guideSource = readFileSync("src/lib/guide.ts", "utf-8");
assert.match(guideSource, /runTrackedStage\(STAGE_KEYS\.GUIDE/);
assert.doesNotMatch(guideSource, /isConditional\)\s*continue/);
const orchestratorSource = readFileSync("src/lib/ai/orchestrator.ts", "utf-8");
assert.match(orchestratorSource, /export async function runTrackedStage/);
assert.match(orchestratorSource, /runTrackedStage\(STAGE_KEYS\.QA/);
assert.match(orchestratorSource, /runTrackedStage\(STAGE_KEYS\.NOTICE/);
assert.match(orchestratorSource, /runTrackedStage\(STAGE_KEYS\.LETTER/);

// Consultant AI cannot restore ineligible candidates.
assert.deepEqual(stageRoles(STAGE_KEYS.MATCH), [STEP_ROLES.MATCH_ANALYST, STEP_ROLES.MATCH_REVIEWER]);
assert.match(promptBody("RESP-MATCH-ANL-v3"), /rank only candidates who already passed deterministic eligibility/);
assert.match(promptBody("RESP-MATCH-REV-v3"), /deterministic eligible pool/);

// Letter and closure safety.
assert.match(promptBody("RESP-LTR-DRAFT-v3"), /do not fabricate/);
assert.match(promptBody("RESP-CLOSE-SUM-v3"), /do not call an issue resolved/);
assert.deepEqual(stageRoles(STAGE_KEYS.CLOSING), [
  STEP_ROLES.CLOSURE_SUMMARIZER,
  STEP_ROLES.CLOSURE_REVIEWER,
  STEP_ROLES.PRESENTER,
]);

// Privacy redaction fixture.
assert.equal(
  redactSensitiveText("Taxpayer SSN 123-45-6789, EIN 12-3456789, account 123456789012."),
  "Taxpayer SSN [REDACTED_TIN], EIN [REDACTED_EIN], account [REDACTED_ACCOUNT_ID].",
);

console.log("AI v3 fixture acceptance checks passed.");
