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
import { EXTRACTION_SCHEMA_VERSION, countPages, extractorSignature, isExtractionCacheValid, storedRawText } from "../src/lib/evidence/extraction-cache";
import { analyzeEvidenceRelationships } from "../src/lib/evidence/reconcile-core";
import { auditEvidence, blocksAnalysis } from "../src/lib/evidence/audit-core";
import { FACT_CLASSIFICATION, synthesizeCase } from "../src/lib/evidence/synthesize-core";
import { ACTION_STATES, actionSatisfiedByEvidence, buildActionGraph, openActions } from "../src/lib/evidence/actions-core";
import { computeReadinessDimensions } from "../src/lib/evidence/readiness-core";
import { formatEvidenceBrief } from "../src/lib/evidence/brief-core";
import { letterCorrectionInstruction, statedAmounts, unsupportedAmounts } from "../src/lib/evidence/letter-guard";
import { EVIDENCE_AUDIT_STATUS } from "../src/lib/evidence/types";
import { amountsEqual, reconcileRefundArithmetic } from "../src/lib/evidence/calculations";
import { evaluateAiV3Readiness } from "../src/lib/ai/readiness-core";
import { redactSensitiveText } from "../src/lib/ai/privacy";
import { sameOriginRedirect } from "../src/lib/http";
import { DOMAIN_RULES_PROMPT_ID, PROMPT_SUPERSEDES, RESPONSIBILITY_PROMPTS, V3_PIPELINE_BLUEPRINT, V3_PROMPT_RECORDS, overlayPromptIdForStage } from "../src/lib/ai/v3-prompts";

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
// Same subject, different intent: these are different work and must not merge.
assert.equal(normalizeActionPurpose("Verify the balance owed"), "VERIFY_AMOUNT");
assert.equal(normalizeActionPurpose("Choose a resolution option for the remaining balance"), "SELECT_RESOLUTION");
assert.notEqual(
  normalizeActionPurpose("Verify the balance owed"),
  normalizeActionPurpose("Choose a resolution option for the remaining balance"),
);
assert.equal(normalizeActionPurpose("Get your IRS account transcript"), "OBTAIN_TRANSCRIPT");
assert.equal(normalizeActionPurpose("Draft a response letter to the IRS"), "DRAFT_CORRESPONDENCE");
assert.equal(normalizeActionPurpose("File the past-due return"), "FILE_RETURN");
assert.equal(normalizeActionPurpose("Have a CPA review this case"), "GET_PROFESSIONAL_REVIEW");
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

// Losing the stored file must not erase text we already extracted from it.
assert.equal(storedRawText(JSON.stringify({ raw_text: "ACCOUNT BALANCE: 10.00" })), "ACCOUNT BALANCE: 10.00");
assert.equal(storedRawText("{}"), "");
assert.equal(storedRawText("not json"), "");

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
assert.match(String(transferRelationship?.description), /\$2,620\.07/, "customer-visible amounts must be formatted, not raw numbers");
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

// The evidence gate decides whether tax reasoning may proceed.
const auditDocument = {
  id: "doc-1",
  fileName: "transcript.pdf",
  documentType: DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT,
  processingStatus: "complete",
  verificationStatus: "verified",
  duplicateOfId: null,
  transactionRowsDetected: 3,
  transactionRowsExtracted: 3,
  factCount: 4,
};
const readyAudit = auditEvidence({ documents: [auditDocument], unknowns: [], facts: [], relationshipCount: 1, calculationCount: 1 });
assert.equal(readyAudit.status, EVIDENCE_AUDIT_STATUS.EVIDENCE_READY);
assert.equal(blocksAnalysis(readyAudit.status), false);

// Partial evidence still produces an answer, with the limitation stated.
const partialAudit = auditEvidence({
  documents: [{ ...auditDocument, processingStatus: "partial", transactionRowsExtracted: 1 }],
  unknowns: [],
  facts: [],
  relationshipCount: 0,
  calculationCount: 0,
});
assert.equal(partialAudit.status, EVIDENCE_AUDIT_STATUS.EVIDENCE_READY_WITH_LIMITATIONS);
assert.equal(blocksAnalysis(partialAudit.status), false, "partial evidence must not leave the customer with nothing");
assert.ok(partialAudit.limitations.length > 0);

// When nothing could be processed, analysis is blocked rather than dressed up
// as taxpayer uncertainty.
const blockedAudit = auditEvidence({
  documents: [{ ...auditDocument, processingStatus: "failed" }],
  unknowns: [],
  facts: [],
  relationshipCount: 0,
  calculationCount: 0,
});
assert.equal(blockedAudit.status, EVIDENCE_AUDIT_STATUS.EVIDENCE_PROCESSING_INCOMPLETE);
assert.equal(blocksAnalysis(blockedAudit.status), true);
assert.ok(blockedAudit.blockingConditions.length > 0);
assert.ok(blockedAudit.processingFailures.length > 0);

// Extraction disagreement needs a person, but does not block the whole case.
const humanReviewAudit = auditEvidence({
  documents: [{ ...auditDocument, verificationStatus: "verification_required" }],
  unknowns: [],
  facts: [],
  relationshipCount: 0,
  calculationCount: 0,
});
assert.equal(humanReviewAudit.status, EVIDENCE_AUDIT_STATUS.HUMAN_DOCUMENT_REVIEW_REQUIRED);
assert.equal(blocksAnalysis(humanReviewAudit.status), false);

// A case with no documents has nothing left to exhaust.
assert.equal(
  auditEvidence({ documents: [], unknowns: [], facts: [], relationshipCount: 0, calculationCount: 0 }).status,
  EVIDENCE_AUDIT_STATUS.EVIDENCE_READY,
);

// An unknown the evidence answers must not survive the audit.
const auditWithUnknowns = auditEvidence({
  documents: [auditDocument],
  unknowns: [
    { key: "issue:1:0", label: "Current balance", text: "Current account balance" },
    { key: "issue:1:1", label: "Filing history", text: "Which years were filed by a preparer" },
  ],
  facts: [{ id: "f1", factKey: FACT_KEYS.ACCOUNT_BALANCE, provenance: PROVENANCE.DOCUMENT_EXTRACTED, valueNumber: 2879 }],
  relationshipCount: 0,
  calculationCount: 0,
});
assert.equal(auditWithUnknowns.unknownsResolvedByExistingEvidence.length, 1);
assert.equal(auditWithUnknowns.unknownsResolvedByExistingEvidence[0].key, "issue:1:0");
assert.deepEqual(auditWithUnknowns.remainingMaterialUnknowns.map((u) => u.key), ["issue:1:1"]);

// Case synthesis reconstructs what happened before anything is interpreted.
const reconstruction = synthesizeCase({
  events: [
    { id: "e1", taxPeriod: "2023", eventType: "RETURN_FILED", transactionCode: "150", description: "Tax return filed", eventDate: new Date("2024-04-15"), amount: 5000 },
    { id: "e2", taxPeriod: "2024", eventType: "CREDIT_TRANSFERRED_OUT", transactionCode: "826", description: "Credit transferred out", eventDate: new Date("2024-05-01"), amount: -2620.07 },
    { id: "e3", taxPeriod: "2023", eventType: "CREDIT_TRANSFERRED_IN", transactionCode: "706", description: "Credit transferred in", eventDate: new Date("2024-05-01"), amount: 2620.07 },
  ],
  facts: [
    { id: "f-old", factKey: FACT_KEYS.ACCOUNT_BALANCE, taxPeriod: "2023", valueNumber: 5000, valueText: "5000", effectiveDate: new Date("2025-01-01"), status: "superseded", provenance: PROVENANCE.DOCUMENT_EXTRACTED },
    { id: "f-new", factKey: FACT_KEYS.ACCOUNT_BALANCE, taxPeriod: "2023", valueNumber: 2879, valueText: "2879", effectiveDate: new Date("2026-03-10"), status: "active", provenance: PROVENANCE.DOCUMENT_EXTRACTED },
    { id: "f-deadline", factKey: FACT_KEYS.NOTICE_DEADLINE, taxPeriod: "2023", valueNumber: null, valueText: "April 1, 2026", effectiveDate: new Date("2026-04-01"), status: "active", provenance: PROVENANCE.DOCUMENT_EXTRACTED },
  ],
  accountStates: [
    { taxPeriod: "2023", currentBalance: 2879, currentBalanceAsOf: new Date("2026-03-10"), currentStatus: "balance_established" },
    { taxPeriod: "2024", currentBalance: null, currentBalanceAsOf: null, currentStatus: "activity_recorded" },
  ],
  relationships: [
    { relationshipType: "CROSS_PERIOD_TRANSFER", fromTaxPeriod: "2024", toTaxPeriod: "2023", amount: 2620.07, status: "CONFIRMED", description: "Credit moved between periods." },
    { relationshipType: "MATCHING_AMOUNT_ACROSS_DOCUMENTS", fromTaxPeriod: "2023", toTaxPeriod: "2023", amount: 2879, status: "POSSIBLE", description: "Same amount in two documents." },
  ],
  unknowns: [{ label: "Filing status", question: "Which filing status was used?", reason: "Not stated in the available records." }],
});

assert.deepEqual(reconstruction.affected_tax_periods, ["2023", "2024"]);
// The timeline must be ordered, and dated documentary facts belong in it too.
assert.deepEqual(
  reconstruction.timeline.map((entry) => entry.date),
  ["2024-04-15", "2024-05-01", "2024-05-01", "2026-04-01"],
);
assert.ok(reconstruction.timeline.some((entry) => entry.entry_type === "NOTICE_DEADLINE"));
assert.ok(reconstruction.timeline.every((entry) => entry.classification === FACT_CLASSIFICATION.ESTABLISHED_EVENT));

// Historical and current positions are separate, not competing.
assert.deepEqual(reconstruction.historical_positions, [
  { tax_period: "2023", value: 5000, as_of: "2025-01-01", classification: FACT_CLASSIFICATION.ESTABLISHED_HISTORICAL_STATE },
]);
assert.deepEqual(reconstruction.current_positions, [
  { tax_period: "2023", value: 2879, as_of: "2026-03-10", classification: FACT_CLASSIFICATION.ESTABLISHED_CURRENT_STATE },
]);

// Confirmed relationships are established; the rest stay inferred.
assert.equal(reconstruction.established_relationships.length, 1);
assert.equal(reconstruction.inferred_relationships.length, 1);
assert.equal(reconstruction.cross_period_events.length, 1);
assert.equal(reconstruction.cross_period_events[0].fromTaxPeriod, "2024");

// A period with activity but no balance is not silently treated as settled.
const periodWithoutBalance = reconstruction.year_by_year_state.find((s) => s.tax_period === "2024");
assert.equal(periodWithoutBalance?.current_balance, null);
assert.equal(periodWithoutBalance?.classification, FACT_CLASSIFICATION.ESTABLISHED_EVENT);
assert.equal(reconstruction.remaining_unresolved_questions[0].classification, FACT_CLASSIFICATION.UNRESOLVED);

// An empty case reconstructs to nothing rather than inventing structure.
const emptyReconstruction = synthesizeCase({ events: [], facts: [], accountStates: [], relationships: [], unknowns: [] });
assert.deepEqual(emptyReconstruction.affected_tax_periods, []);
assert.deepEqual(emptyReconstruction.timeline, []);

// v3.2 analysis: analysts consume the reconstruction instead of rediscovering
// the case, and a released prompt body is superseded rather than edited.
assert.match(promptBody("RESP-ANL-v32"), /reconstructed case, not discovering/);
assert.match(promptBody("RESP-ANL-v32"), /document_verified and system_calculated facts as established/);
assert.match(promptBody("RESP-ANL-v32"), /challenge_fact_id/);
assert.match(promptBody("RESP-ANL-v32"), /remaining_unresolved_questions/);
assert.match(promptBody("RESP-SKEP-v32"), /historical and current values are being confused/);
assert.match(promptBody("RESP-SKEP-v32"), /unknown kept active when the compiled evidence already answers it/);
assert.match(promptBody("RESP-REV-v32"), /internal task, an extraction gap, or a processing failure/);
assert.match(promptBody("RESP-REV-v32"), /request_reanalysis/);

const situationSteps = V3_PIPELINE_BLUEPRINT.find((p) => p.key === STAGE_KEYS.SITUATION)!.steps;
assert.deepEqual(
  situationSteps.filter((s) => s.role === STEP_ROLES.ANALYST).map((s) => s.promptId),
  ["RESP-ANL-v32", "RESP-ANL-v32"],
  "both analysts must run the evidence-first prompt",
);
assert.equal(situationSteps.find((s) => s.role === STEP_ROLES.SKEPTIC)?.promptId, "RESP-SKEP-v32");
assert.equal(situationSteps.find((s) => s.role === STEP_ROLES.REVIEWER)?.promptId, "RESP-REV-v32");

// Every superseded prompt must still exist, and point at its replacement.
for (const [oldId, newId] of Object.entries(PROMPT_SUPERSEDES)) {
  assert.ok(V3_PROMPT_RECORDS.some((p) => p.promptId === oldId), `superseded prompt ${oldId} must be retained for history`);
  const replacement = V3_PROMPT_RECORDS.find((p) => p.promptId === newId);
  assert.ok(replacement, `replacement prompt ${newId} must exist`);
  if (replacement?.kind === "responsibility") {
    assert.equal(replacement.supersedesPromptId, oldId, `${newId} must record what it supersedes`);
  }
}

// The evidence-first domain policy is what every model now inherits.
assert.match(domainRules.body.toLowerCase(), /evidence already held by taxonme must be exhausted/);
assert.match(domainRules.body.toLowerCase(), /a processing failure is never a taxpayer unknown/);

// Action intelligence: work the evidence already did must not be shown as a
// task the customer still owes.
const actionSteps = [
  { id: "s1", actionKey: "review_notice", title: "Review the IRS notice", description: "Confirm the notice number and date.", status: "current", sortOrder: 0 },
  { id: "s2", actionKey: "confirm_notice", title: "Confirm notice details", description: "Check the notice code again.", status: "pending", sortOrder: 1 },
  { id: "s3", actionKey: "verify_balance", title: "Verify the balance owed", description: "Establish the amount currently due.", status: "pending", sortOrder: 2 },
  { id: "s4", actionKey: "professional_review", title: "Get professional review", description: "Have a licensed professional review the case.", status: "pending", sortOrder: 3 },
];
const noticeFacts = [
  { id: "f-notice", factKey: FACT_KEYS.NOTICE_CODE, provenance: PROVENANCE.DOCUMENT_EXTRACTED, valueText: "CP2000" },
];

const actionGraph = buildActionGraph(actionSteps, noticeFacts);
const noticeAction = actionGraph.find((n) => n.sourceStepId === "s1");
assert.equal(noticeAction?.status, ACTION_STATES.COMPLETED, "an action the evidence already satisfies is complete");
assert.deepEqual(noticeAction?.satisfiedByFactIds, ["f-notice"]);

// The same intent stated twice is one action; the repeat becomes history.
const duplicateAction = actionGraph.find((n) => n.sourceStepId === "s2");
assert.equal(duplicateAction?.status, ACTION_STATES.SUPERSEDED);
assert.equal(duplicateAction?.priority, 0, "a superseded action does not take a place in the path");

// The path forward starts at the next genuinely unresolved action.
const open = openActions(actionGraph);
assert.equal(open[0].sourceStepId, "s3", "the customer path must begin at the next unresolved action");
assert.equal(open[0].status, ACTION_STATES.READY);
assert.ok(open.every((n) => n.status !== ACTION_STATES.COMPLETED), "completed work must not appear as future tasks");

// Professional review is not required unless the case calls for it.
assert.equal(actionGraph.find((n) => n.sourceStepId === "s4")?.status, ACTION_STATES.NOT_REQUIRED);
assert.equal(
  buildActionGraph(actionSteps, noticeFacts, { professionalReviewRecommended: true }).find((n) => n.sourceStepId === "s4")?.status,
  ACTION_STATES.BLOCKED,
  "professional review waits behind the unresolved work in front of it",
);

// Later work is blocked while earlier work is outstanding.
const blockedGraph = buildActionGraph(actionSteps, []);
assert.equal(blockedGraph.find((n) => n.sourceStepId === "s1")?.status, ACTION_STATES.READY);
assert.equal(blockedGraph.find((n) => n.sourceStepId === "s3")?.status, ACTION_STATES.BLOCKED);
assert.deepEqual(blockedGraph.find((n) => n.sourceStepId === "s3")?.dependsOnStepIds, ["s1"]);

// The customer's own words never complete an investigation.
assert.equal(
  actionSatisfiedByEvidence("VERIFY_AMOUNT", [{ id: "u", factKey: FACT_KEYS.ACCOUNT_BALANCE, provenance: PROVENANCE.USER_REPORTED, valueNumber: 500 }]).satisfied,
  false,
);
assert.equal(
  actionSatisfiedByEvidence("VERIFY_AMOUNT", [{ id: "d", factKey: FACT_KEYS.ACCOUNT_BALANCE, provenance: PROVENANCE.DOCUMENT_EXTRACTED, valueNumber: 500 }]).satisfied,
  true,
);
// An action with no evidence definition is never auto-completed.
assert.equal(actionSatisfiedByEvidence("UNCLASSIFIED_ACTION", noticeFacts).satisfied, false);

// Readiness: our own processing gaps must not be charged to the customer.
const providedDocuments = [
  { fileName: "transcript-2023.pdf", processingStatus: "complete" },
  { fileName: "transcript-2024.pdf", processingStatus: "complete" },
  { fileName: "scan.pdf", processingStatus: "failed" },
];
const evidenceFactsForReadiness = [
  { provenance: PROVENANCE.DOCUMENT_EXTRACTED },
  { provenance: PROVENANCE.DOCUMENT_EXTRACTED },
  { provenance: PROVENANCE.SYSTEM_CALCULATED },
  { provenance: PROVENANCE.USER_REPORTED },
];
const readinessInput = {
  documents: providedDocuments,
  documentsExpected: 3,
  facts: evidenceFactsForReadiness,
  unknowns: [
    { status: "OPEN", label: "Whether a payment plan exists" },
    { status: "RESOLVED_BY_EXISTING_EVIDENCE", label: "The 2023 balance" },
  ],
  unresolvedConflicts: 0,
  irsSourcesMatched: 2,
};
const readiness = computeReadinessDimensions(readinessInput);
assert.equal(readiness.evidenceAvailable, 100, "the customer provided everything the case expected");
assert.equal(readiness.evidenceProcessed, 67, "our side reports honestly that one file is unread");
assert.equal(readiness.processingGap, true);
assert.equal(readiness.documentsUnread, 1);
assert.match(readiness.limitations[0], /could not be read on our side/);

// Reading the outstanding file raises readiness without changing what the
// customer provided — proving the gap was ours, not theirs.
const afterProcessing = computeReadinessDimensions({
  ...readinessInput,
  documents: providedDocuments.map((d) => ({ ...d, processingStatus: "complete" })),
});
assert.equal(afterProcessing.evidenceAvailable, readiness.evidenceAvailable, "closing our gap does not change what they gave us");
assert.equal(afterProcessing.evidenceProcessed, 100);
assert.equal(afterProcessing.processingGap, false);
assert.ok(afterProcessing.caseReadiness > readiness.caseReadiness, "reading a document we already held must raise readiness");

// An unknown the evidence already answered must not depress readiness.
const withResolvedUnknowns = computeReadinessDimensions({
  ...readinessInput,
  unknowns: [
    { status: "OPEN", label: "Whether a payment plan exists" },
    ...Array.from({ length: 5 }, () => ({ status: "RESOLVED_BY_EXISTING_EVIDENCE", label: "Answered by a transcript" })),
  ],
});
assert.equal(withResolvedUnknowns.caseReadiness, readiness.caseReadiness, "resolved unknowns must not count against readiness");
assert.equal(withResolvedUnknowns.resolvedUnknowns, 5);

// A duplicate upload is neither extra evidence nor an extra processing failure.
const withDuplicate = computeReadinessDimensions({
  ...readinessInput,
  documents: [...providedDocuments, { fileName: "transcript-2023-copy.pdf", processingStatus: "failed", duplicateOfId: "doc-1" }],
});
assert.equal(withDuplicate.documentsProvided, 3, "duplicates are counted once");
assert.equal(withDuplicate.evidenceProcessed, readiness.evidenceProcessed);

// An empty case is not a processing failure on our side.
const emptyCase = computeReadinessDimensions({ ...readinessInput, documents: [], facts: [], unknowns: [], irsSourcesMatched: 0 });
assert.equal(emptyCase.evidenceAvailable, 0);
assert.equal(emptyCase.evidenceProcessed, 100, "with nothing uploaded there is nothing we failed to read");
assert.equal(emptyCase.processingGap, false);

// The evidence brief is the one view of the case every downstream surface reads.
const briefFacts = [
  { factKey: "account_balance", provenance: PROVENANCE.DOCUMENT_EXTRACTED, valueText: "", valueNumber: 2879, taxPeriod: "2023" },
  { factKey: "refund_issued", provenance: PROVENANCE.DOCUMENT_EXTRACTED, valueText: "", valueNumber: 427.93, taxPeriod: "2023" },
  { factKey: "balance_reported", provenance: PROVENANCE.USER_REPORTED, valueText: "", valueNumber: 5000, taxPeriod: "2023" },
];
const brief = formatEvidenceBrief({
  periods: [{ taxPeriod: "2023", currentBalance: 2879, currentBalanceAsOf: new Date("2026-03-10T00:00:00Z") }],
  facts: briefFacts,
  events: [
    { taxPeriod: "2023", eventType: "REFUND_ISSUED", description: "Refund issued", eventDate: new Date("2024-05-10T00:00:00Z"), amount: 427.93 },
  ],
  relationships: [
    { relationshipType: "CROSS_PERIOD_TRANSFER", description: "A credit of $2,620.07 left 2023 and was applied to 2024.", status: "CONFIRMED" },
    { relationshipType: "MATCHING_AMOUNT_ACROSS_DOCUMENTS", description: "Two documents share an amount.", status: "POSSIBLE" },
  ],
  unknowns: [
    { label: "Whether a payment plan is already in place", status: "ACTIVE", reason: "No record establishes this." },
    { label: "The 2023 balance", status: "RESOLVED_BY_EXISTING_EVIDENCE", reason: "The transcript states it." },
  ],
  limitations: ["scanned-notice.pdf could not be read."],
});
assert.equal(brief.hasEvidence, true);
assert.match(brief.text, /\$2,879\.00/, "the established balance must be stated as currency");
assert.match(brief.text, /as of 2026-03-10/, "an account position without its date invites a stale assertion");
assert.match(brief.text, /REPORTED BY THE CUSTOMER, NOT ESTABLISHED/, "user-reported figures must be quarantined from established ones");
assert.ok(!brief.openUnknowns.includes("The 2023 balance"), "an unknown the evidence answered is not still open");
assert.deepEqual(brief.openUnknowns, ["Whether a payment plan is already in place"]);
assert.match(brief.text, /A credit of \$2,620\.07 left 2023/, "confirmed relationships belong in the brief");
assert.ok(!brief.text.includes("Two documents share an amount"), "an unconfirmed relationship must not read as established");
assert.match(brief.text, /scanned-notice\.pdf could not be read/, "limits on the evidence travel with it");

// A case with nothing on file must say so rather than inviting invention.
const emptyBrief = formatEvidenceBrief({ periods: [], facts: [], events: [], relationships: [], unknowns: [], limitations: [] });
assert.equal(emptyBrief.hasEvidence, false);
assert.deepEqual(emptyBrief.statableAmounts, []);
assert.match(emptyBrief.text, /Do not state any figure/);

// Letter guard: a figure the evidence does not establish never reaches the IRS.
const groundedLetter = "The account shows a balance of $2,879.00 for 2023 and a refund of $427.93 was issued.";
assert.deepEqual(unsupportedAmounts(groundedLetter, brief.statableAmounts), [], "figures drawn from the evidence pass");

const inventedLetter = "I believe I am owed a refund of $3,412.55 and the balance should be $2,879.00.";
assert.deepEqual(
  unsupportedAmounts(inventedLetter, brief.statableAmounts),
  [3412.55],
  "a figure absent from the evidence must be caught",
);

// The customer's own stated figures are their claim to make.
assert.deepEqual(unsupportedAmounts(inventedLetter, [...brief.statableAmounts, ...statedAmounts("I paid $3,412.55 in March.")]), []);

// A transcript records a refund as a credit; a letter calls it a payment owed.
// That sign difference is presentation, not a contradiction.
assert.deepEqual(unsupportedAmounts("A refund of $427.93 was issued.", [-427.93]), []);

// The correction instruction names the offending figures so the retry is targeted.
assert.match(letterCorrectionInstruction([3412.55]), /\$3,412\.55/);
assert.match(letterCorrectionInstruction([3412.55]), /does not establish/);

// Every customer-facing surface must be told to work from the evidence.
for (const overlayId of ["QA-OVERLAY-v32", "NOTICE-OVERLAY-v32", "LETTER-OVERLAY-v32", "CASE-OVERLAY-v32", "CLOSE-OVERLAY-v32"]) {
  const overlay = V3_PROMPT_RECORDS.find((p) => p.promptId === overlayId);
  assert.ok(overlay, `${overlayId} must exist`);
  assert.match(overlay!.body, /\{\{case_evidence\}\}/, `${overlayId} must consume the evidence brief`);
  assert.ok(overlay!.supersedesPromptId, `${overlayId} must supersede its v3 predecessor rather than silently replacing it`);
  assert.equal(PROMPT_SUPERSEDES[overlay!.supersedesPromptId!], overlayId, `${overlayId} must be reachable from the supersedes map`);
}
// The stage lookup must resolve to the evidence-first overlay, not the old one.
assert.equal(overlayPromptIdForStage(STAGE_KEYS.LETTER), "LETTER-OVERLAY-v32");
assert.equal(overlayPromptIdForStage(STAGE_KEYS.QA), "QA-OVERLAY-v32");
// The letter overlay carries the reason the rule exists, not just the rule.
const letterOverlay = V3_PROMPT_RECORDS.find((p) => p.promptId === "LETTER-OVERLAY-v32")!;
assert.match(letterOverlay.body, /over the customer's name/);
assert.match(letterOverlay.body, /Never estimate, round, or infer a figure/);

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
assert.match(promptBody("RESP-ANL-v32"), /do not manufacture/);
assert.match(promptBody("RESP-SRC-v3"), /source_missing/);
assert.match(promptBody("RESP-REV-v32"), /downgrade/);

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

// Extra-report and form-download paywalls must stay on the host the customer
// is already on. Building Location from request.url inherits localhost.
const billingRedirect = sameOriginRedirect("/app/billing?upgrade=forms-download");
assert.equal(billingRedirect.status, 303);
assert.equal(billingRedirect.headers.get("Location"), "/app/billing?upgrade=forms-download");
assert.equal(new URL(billingRedirect.headers.get("Location")!, "https://app.example.com").host, "app.example.com");
assert.throws(() => sameOriginRedirect("https://localhost:3000/app/billing?upgrade=report"));
assert.throws(() => sameOriginRedirect("//evil.example/phish"));
const reportRoute = readFileSync("src/app/api/cases/[id]/report/route.ts", "utf8");
assert.match(reportRoute, /sameOriginRedirect\(/);
assert.match(reportRoute, /consumeCaseReportDownload/);
assert.doesNotMatch(reportRoute, /new URL\("\/app\/billing\?upgrade=report", request\.url\)/);
assert.doesNotMatch(reportRoute, /\/app\/billing\?upgrade=report/);
const casePage = readFileSync("src/app/app/cases/[id]/page.tsx", "utf8");
assert.doesNotMatch(casePage, /Re-run analysis/);
assert.doesNotMatch(casePage, /reanalyzeCaseAction/);
assert.match(casePage, /CaseReportCta/);
const analysisView = readFileSync("src/components/case-analysis-view.tsx", "utf8");
assert.doesNotMatch(analysisView, /Re-run the analysis now/);
assert.doesNotMatch(analysisView, /reanalyzeCaseAction/);
const consultantCasePage = readFileSync("src/app/consultant/clients/[id]/cases/[caseId]/page.tsx", "utf8");
assert.doesNotMatch(consultantCasePage, /Re-run analysis/);
assert.match(consultantCasePage, /CaseReportCta/);
const seed = readFileSync("prisma/seed.ts", "utf8");
assert.match(seed, /key: "free"[\s\S]*"case\.report": \{ enabled: true, limit: 1 \}/);
assert.match(seed, /key: "plus"[\s\S]*"case\.report": \{ enabled: true, limit: 3 \}/);
assert.match(seed, /key: "pro"[\s\S]*"case\.report": \{ enabled: true, limit: 7 \}/);
assert.match(seed, /billing\.case_report_extra_cents/);
assert.match(readFileSync("src/app/admin/plans/page.tsx", "utf8"), /CaseReportExtraFeeForm/);
assert.match(readFileSync("src/app/api/webhooks/stripe/route.ts", "utf8"), /CASE_REPORT_EXTRA/);

console.log("AI v3 fixture acceptance checks passed.");
