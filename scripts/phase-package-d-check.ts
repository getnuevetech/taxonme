/**
 * Package D — approval gate wired into customer output (fail closed).
 * Run: npx tsx scripts/phase-package-d-check.ts
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
  const {
    applyApprovalGateFailClosed,
    blockedCustomerPresentation,
    buildOrchestratorGateInput,
    customerFacingTextFromOutputs,
    matterBriefFromNarrative,
  } = await import("../src/lib/approval-gate-apply");
  const { evaluateApprovalGate, selectApprovedPresentation } = await import("../src/lib/approval-gate");
  const { thinEvidencePathSteps } = await import("../src/lib/path-from-analysis");
  const { lockFromFixture, LEVY_FIXTURE } = await import("../src/lib/v51-fixture-pack");

  const thinPath = thinEvidencePathSteps({ hasDocs: false, hasTranscript: false });
  assert.ok(thinPath.length >= 1);

  {
    const brief = matterBriefFromNarrative("Received LT11 intent to levy notice");
    assert.equal(brief?.primaryModule, "collection_levy");
    assert.equal(matterBriefFromNarrative("thin balance due")?.primaryModule, undefined);
  }

  {
    const text = customerFacingTextFromOutputs({
      presentation: { next_step: { title: "File a new Form 1040 first" } },
      issues: [{ title: "Levy", next_action: "You should file a new Form 1040 first." }],
      pathSteps: [{ title: "Start new return", description: "File 1040", action_key: "COMPLETE_FORM" }],
    });
    assert.match(text, /Form 1040/);
  }

  {
    const presentation: Record<string, unknown> = {
      issues: [{ title: "Unsafe", next_action: "You should file a new Form 1040 first." }],
      path_steps: [{ title: "Offer in compromise", description: "Start OIC", action_key: "DRAFT_LETTER" }],
    };
    const resolutionPath = [
      { title: "Prepare Form 9465", description: "payment plan", action_key: "COMPLETE_FORM_9465" },
      { title: "Evaluate penalty relief", description: "abatement", action_key: "DRAFT_LETTER" },
    ];
    const candidateIssues = [
      { title: "Unsafe", next_action: "You should file a new Form 1040 first." },
    ];
    const safeIssues = [
      {
        issue_type: "balance_due",
        item_kind: "missing_info",
        title: "IRS balance needs to be identified",
        explanations: [],
      },
    ];

    const gateInput = buildOrchestratorGateInput({
      caseId: "case-1",
      analysisVersionId: "av-1",
      situation: "I got a levy notice LT11",
      goal: "Stop the levy",
      documents: [{ fileName: "lt11.pdf", documentType: "IRS_NOTICE", contentHash: "x" }],
      customerText: customerFacingTextFromOutputs({
        presentation,
        issues: candidateIssues,
        pathSteps: resolutionPath,
      }),
    });
    // Explicit lock (same as fixture) so the BLOCK is deterministic.
    gateInput.lock = lockFromFixture(LEVY_FIXTURE);
    gateInput.customerText = "You should file a new Form 1040 first.";

    const audit = evaluateApprovalGate(gateInput);
    assert.equal(audit.gate_result, "BLOCK");
    assert.equal(selectApprovedPresentation(presentation, audit), null);

    const applied = applyApprovalGateFailClosed({
      gateInput,
      presentation,
      issues: candidateIssues as Record<string, unknown>[],
      pathSteps: resolutionPath,
      thinPathSteps: thinPath,
      safeIssues: safeIssues as Record<string, unknown>[],
    });
    assert.equal(applied.blocked, true);
    assert.equal(applied.presentation, null);
    assert.deepEqual(applied.issues, safeIssues);
    assert.deepEqual(applied.pathSteps, thinPath);
    assert.equal(applied.pathSteps.some((s) => /9465|penalty relief/i.test(s.title)), false);
    assert.equal(applied.presentationToStore?.schema, "approval_gate_blocked");
    assert.match(JSON.stringify(blockedCustomerPresentation(audit)), /held for review/i);
  }

  {
    const pass = applyApprovalGateFailClosed({
      gateInput: {
        documents: [{ fileName: "cp2000.pdf", documentType: "IRS_NOTICE", contentHash: "a" }],
        customerText: "Respond to the CP2000 with supporting wage evidence.",
        documentCount: 1,
      },
      presentation: { issues: [{ title: "CP2000 response" }], ok: true },
      issues: [{ title: "CP2000 response" }],
      pathSteps: [{ title: "Respond to notice", description: "deadline", action_key: "DRAFT_LETTER" }],
      thinPathSteps: thinPath,
      safeIssues: [],
    });
    assert.equal(pass.blocked, false);
    assert.equal(pass.presentation?.ok, true);
    assert.equal(pass.pathSteps[0]?.title, "Respond to notice");
  }

  const root = process.cwd();
  const orch = readFileSync(join(root, "src/lib/ai/orchestrator.ts"), "utf8");
  assert.match(orch, /applyApprovalGateFailClosed/);
  assert.match(orch, /approval_gate/);
  assert.match(orch, /Approval gate blocked customer presentation/);
  assert.match(
    readFileSync(join(root, "docs/v5.1/PACKAGE-D-APPROVAL-GATE-WIRE.md"), "utf8"),
    /Package D/i,
  );

  console.log("phase-package-d-check: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
