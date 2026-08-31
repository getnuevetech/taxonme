/**
 * Phase B — fact ledger + authority + invalidation (tax).
 * Run: npx tsx scripts/phase-b-fact-ledger-check.ts
 */
import assert from "node:assert/strict";
import { authorityForDocumentType, formatContentHash, isIrsGovernmentType } from "../src/lib/evidence/authority";
import { buildFactLedger, ledgerFact } from "../src/lib/evidence/fact-ledger";
import { markStaleAfterEvidenceChange, emptyInvalidation } from "../src/lib/evidence/invalidation";
import { DOCUMENT_TYPES } from "../src/lib/evidence/types";

{
  assert.equal(authorityForDocumentType(DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT).issuer, "IRS");
  assert.ok(isIrsGovernmentType(DOCUMENT_TYPES.IRS_NOTICE));
  assert.equal(formatContentHash("abc"), "sha256:abc");
  assert.equal(formatContentHash("sha256:abc"), "sha256:abc");
}

{
  const ledger = buildFactLedger({
    situation: "I owe money for tax year 2023. Balance due about 5000.",
    goal: "Confirm balance",
    documents: [
      {
        id: "doc1",
        fileName: "account-transcript.pdf",
        documentType: DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT,
        contentHash: "hash1",
        text: "ACCOUNT TRANSCRIPT\nTAX PERIOD ENDING: Dec. 31, 2023\nACCOUNT BALANCE: 2,879.00",
      },
    ],
  });
  const bal = ledgerFact(ledger, "ACCOUNT_BALANCE");
  assert.equal(bal?.status, "VERIFIED");
  assert.equal(bal?.value, 2879);
  assert.ok(bal?.sources?.[0]?.document_id === "doc1");
  assert.equal(ledgerFact(ledger, "TRANSCRIPT_ON_FILE")?.status, "VERIFIED");
  assert.equal(ledgerFact(ledger, "TAX_YEAR")?.status, "VERIFIED");
}

{
  const reported = buildFactLedger({
    situation: "I think I owe about $4,000 for 2022 but I have no transcript yet.",
    goal: "Understand balance",
  });
  assert.equal(ledgerFact(reported, "ACCOUNT_BALANCE")?.status, "REPORTED");
  assert.equal(ledgerFact(reported, "TRANSCRIPT_ON_FILE")?.status, "UNKNOWN");
  assert.ok((reported.evidence_gaps?.length ?? 0) >= 1);
  assert.ok((reported.unverified_claims?.length ?? 0) >= 1);
}

{
  const first = markStaleAfterEvidenceChange("new document");
  assert.equal(first.customerOutputStale, true);
  const coalesced = markStaleAfterEvidenceChange("reclassify", 30_000, first);
  assert.equal(coalesced.invalidationPendingAt, first.invalidationPendingAt);
  assert.equal(emptyInvalidation().customerOutputStale, false);
}

console.log("phase-b-fact-ledger-check: ok");
