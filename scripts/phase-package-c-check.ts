/**
 * Package C — path completion, readiness, paywall safety gate.
 * Run: npx tsx scripts/phase-package-c-check.ts
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
  const { buildRankedTaxActions } = await import("../src/lib/action-priority");
  const {
    pathStepsFromRankedActions,
    filterResolutionPathSteps,
    resolutionEligibility,
    thinEvidencePathSteps,
  } = await import("../src/lib/path-from-analysis");
  const {
    uploadDocumentsSatisfied,
    reviewAnalysisSatisfied,
    isEvidenceAuditPassing,
  } = await import("../src/lib/case-progress-core");
  const {
    computeReadinessDimensions,
    isOpenUnknownStatus,
    readinessPresentationMode,
  } = await import("../src/lib/evidence/readiness-core");
  const {
    sortIssuesBySeverity,
    isPaywallProtectedFinding,
    selectVisibleIssues,
  } = await import("../src/lib/issue-visibility");
  const { fallbackAnalyze } = await import("../src/lib/ai/fallback");

  const thinEv = {
    hasDocs: false,
    hasTranscript: false,
    hasAmount: false,
    hasTaxYear: false,
  };
  assert.deepEqual(resolutionEligibility(thinEv), { installment: false, penaltyRelief: false });

  const thinPath = thinEvidencePathSteps({ hasDocs: false, hasTranscript: false });
  assert.equal(thinPath.some((s) => /9465|payment plan|penalty relief/i.test(s.title)), false);

  const filtered = filterResolutionPathSteps(
    [
      ...thinPath,
      { title: "Prepare a payment plan request (Form 9465)", description: "x", action_key: "COMPLETE_FORM_9465" },
      { title: "Evaluate penalty relief options", description: "x", action_key: "DRAFT_LETTER" },
    ],
    resolutionEligibility(thinEv),
  );
  assert.equal(filtered.some((s) => /9465|penalty relief/i.test(s.title)), false);

  const levyActions = buildRankedTaxActions({ hasNoticeDeadline: true });
  const levyPath = pathStepsFromRankedActions(levyActions);
  assert.ok(levyPath.length >= 1);

  assert.equal(
    uploadDocumentsSatisfied([{ docKind: "w2", documentType: "W2" }], ["transcript", "notice"]),
    false,
  );
  assert.equal(
    uploadDocumentsSatisfied([{ docKind: "transcript", documentType: "IRS_ACCOUNT_TRANSCRIPT" }], [
      "transcript",
      "notice",
    ]),
    true,
  );
  assert.equal(
    reviewAnalysisSatisfied({
      hasRunAfterNewestDoc: true,
      auditStatus: "EVIDENCE_PROCESSING_INCOMPLETE",
    }),
    false,
  );
  assert.equal(
    reviewAnalysisSatisfied({ hasRunAfterNewestDoc: true, auditStatus: "EVIDENCE_READY" }),
    true,
  );
  assert.equal(
    reviewAnalysisSatisfied({ hasRunAfterNewestDoc: false, auditStatus: "EVIDENCE_READY" }),
    false,
  );
  assert.equal(isEvidenceAuditPassing("EVIDENCE_READY_WITH_LIMITATIONS"), true);

  assert.equal(isOpenUnknownStatus("ACTIVE"), true);
  assert.equal(isOpenUnknownStatus("OPEN"), true);
  assert.equal(isOpenUnknownStatus("RESOLVED_BY_EXISTING_EVIDENCE"), false);

  const dims = computeReadinessDimensions({
    documents: [],
    documentsExpected: 3,
    facts: [],
    unknowns: [{ status: "ACTIVE", label: "balance" }],
    unresolvedConflicts: 0,
    irsSourcesMatched: 0,
  });
  assert.equal(dims.openUnknowns, 1);
  assert.ok(dims.caseReadiness < 15);
  assert.equal(
    readinessPresentationMode({ documentsProvided: 0, evidentiaryFacts: 0, caseTypeThin: true }),
    "checklist",
  );

  const mixed = [
    { id: "h", priority: "high", itemKind: "issue", title: "Balance composition" },
    { id: "u", priority: "urgent", itemKind: "risk", title: "LT11 levy risk", state: "urgent" },
  ];
  assert.equal(sortIssuesBySeverity(mixed)[0].id, "u");
  assert.equal(isPaywallProtectedFinding(mixed[1]), true);
  const paywalled = selectVisibleIssues(mixed, { fullAccess: false });
  assert.ok(paywalled.visible.some((i) => i.id === "u"));

  const result = await fallbackAnalyze(
    "I owe IRS some money but I am not sure how much and what I need to do.",
    "I need to know what I owe and what to do.",
    "",
    [],
  );
  assert.equal(result.pathSteps.some((s) => /9465|penalty relief/i.test(s.title)), false);
  assert.match(result.pathSteps[0]?.description ?? "", /required|transcript|notice/i);

  const root = process.cwd();
  assert.match(readFileSync(join(root, "docs/v5.1/PACKAGE-C-PATH-PAYWALL.md"), "utf8"), /Package C/i);

  console.log("phase-package-c-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
