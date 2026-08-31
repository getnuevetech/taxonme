/**
 * Phase E — approval gate (tax).
 * Run: npx tsx scripts/phase-e-approval-gate-check.ts
 */
import assert from "node:assert/strict";
import {
  APPROVAL_GATE_BLOCK_IDS,
  evaluateApprovalGate,
  selectApprovedPresentation,
  withGateOverride,
} from "../src/lib/approval-gate";
import { buildFactLedger } from "../src/lib/evidence/fact-ledger";
import { DOCUMENT_TYPES } from "../src/lib/evidence/types";
import { lockFromFixture, LEVY_FIXTURE, CP2000_FIXTURE } from "../src/lib/v51-fixture-pack";

assert.ok(APPROVAL_GATE_BLOCK_IDS.includes("BLOCK-DOC-MISCLASS-NOTICE-AS-OTHER"));

{
  const pass = evaluateApprovalGate({
    lock: lockFromFixture(CP2000_FIXTURE),
    documents: [{ fileName: "cp2000.pdf", documentType: DOCUMENT_TYPES.IRS_NOTICE, contentHash: "a" }],
    factLedger: buildFactLedger({
      situation: CP2000_FIXTURE.situation,
      goal: CP2000_FIXTURE.goal,
      documents: [
        {
          id: "1",
          fileName: "cp2000.pdf",
          documentType: DOCUMENT_TYPES.IRS_NOTICE,
          text: "CP2000",
        },
        {
          id: "2",
          fileName: "account-transcript.pdf",
          documentType: DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT,
          text: "ACCOUNT BALANCE: 2,879.00 TAX PERIOD 2023",
        },
      ],
    }),
    customerText: "Respond to the CP2000 with supporting wage evidence.",
    documentCount: 2,
  });
  assert.equal(pass.gate_result, "PASS");
  assert.equal(selectApprovedPresentation({ ok: true }, pass)?.ok, true);
}

{
  const block = evaluateApprovalGate({
    lock: lockFromFixture(LEVY_FIXTURE),
    documents: [{ fileName: "lt11.pdf", documentType: DOCUMENT_TYPES.IRS_NOTICE, contentHash: "x" }],
    customerText: "You should file a new Form 1040 first.",
    documentCount: 1,
  });
  assert.equal(block.gate_result, "BLOCK");
  assert.ok(block.rule_ids.includes("BLOCK-LOCK-NEW-1040-IN-COLLECTIONS"));
  assert.equal(selectApprovedPresentation({ ok: true }, block), null);

  const overridden = withGateOverride(block, { by: "staff@example.com", reason: "manual review" });
  assert.equal(overridden.gate_result, "PASS");
  assert.equal(overridden.previous_gate_result, "BLOCK");
  assert.equal(overridden.override_by, "staff@example.com");
}

{
  const stale = evaluateApprovalGate({
    documents: [],
    customerOutputStale: true,
    documentCount: 0,
  });
  assert.ok(stale.rule_ids.includes("BLOCK-STATE-STALE-DERIVED-OUTPUT"));
}

{
  const plan = evaluateApprovalGate({
    documents: [{ fileName: "w2.pdf", documentType: DOCUMENT_TYPES.W2 }],
    documentCount: 1,
    openOptions: true,
    planSkipReason: "Document processing is not needed for this options review",
  });
  assert.ok(plan.rule_ids.includes("BLOCK-PLAN-DOCS-SKIPPED-WHILE-USED"));
}

{
  const dedup = evaluateApprovalGate({
    documents: [
      { id: "a", fileName: "n.pdf", documentType: DOCUMENT_TYPES.IRS_NOTICE, contentHash: "same" },
      { id: "b", fileName: "n-copy.pdf", documentType: DOCUMENT_TYPES.IRS_NOTICE, contentHash: "same" },
    ],
    documentCount: 2,
  });
  assert.ok(dedup.rule_ids.includes("BLOCK-DEDUP-DUPLICATE-EVIDENCE-ROW"));
}

console.log("phase-e-approval-gate-check: ok");
