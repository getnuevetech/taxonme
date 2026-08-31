/**
 * Phase A — classification, labels, plan honesty (tax).
 * Run: npx tsx scripts/phase-a-classification-check.ts
 */
import assert from "node:assert/strict";
import { classifyDocument } from "../src/lib/evidence/classify";
import { taxDocumentTypeLabel } from "../src/lib/evidence/document-labels";
import { dedupeDocumentsByHash } from "../src/lib/evidence/fact-ledger";
import { DOCUMENT_TYPES } from "../src/lib/evidence/types";
import { processDocumentsSkipReason } from "../src/lib/matter-analysis-plan";

{
  const notice = classifyDocument({
    fileName: "cp2000-2023.pdf",
    text: "",
    docKind: "other",
  });
  assert.equal(notice.documentType, DOCUMENT_TYPES.IRS_NOTICE);
  assert.notEqual(taxDocumentTypeLabel(notice.documentType), "Unknown Tax Document");

  const transcript = classifyDocument({
    fileName: "account-transcript.pdf",
    text: "",
    docKind: "other",
  });
  assert.equal(transcript.documentType, DOCUMENT_TYPES.IRS_ACCOUNT_TRANSCRIPT);

  const w2 = classifyDocument({
    fileName: "scan-001.pdf",
    text: "Form W-2 Wage and Tax Statement",
    docKind: "other",
  });
  assert.equal(w2.documentType, DOCUMENT_TYPES.W2);
  assert.match(taxDocumentTypeLabel(w2.documentType), /W-2/i);

  const unknown = classifyDocument({
    fileName: "scan-001.pdf",
    text: "",
    docKind: "other",
  });
  assert.equal(unknown.documentType, DOCUMENT_TYPES.UNKNOWN_TAX_DOCUMENT);
}

{
  const deduped = dedupeDocumentsByHash([
    { id: "a", fileName: "t.pdf", contentHash: "h1", documentType: "IRS_NOTICE" },
    { id: "b", fileName: "t-copy.pdf", contentHash: "h1", documentType: "IRS_NOTICE" },
    { id: "c", fileName: "dup.pdf", duplicateOfId: "a", documentType: "IRS_NOTICE" },
  ]);
  assert.equal(deduped.length, 1);
}

{
  assert.match(processDocumentsSkipReason({ openOptions: true, documentCount: 0 }), /options review/i);
  assert.equal(
    processDocumentsSkipReason({ openOptions: true, documentCount: 3 }),
    "Documents already processed and current",
  );
  assert.ok(!/options review/i.test(processDocumentsSkipReason({ openOptions: true, documentCount: 1 })));
}

console.log("phase-a-classification-check: ok");
