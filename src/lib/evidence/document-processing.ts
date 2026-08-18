import "server-only";
import { db } from "../db";
import { EXTRACTION_SCHEMA_VERSION } from "./extraction-cache";
import { PROCESSING_STATUS } from "./types";

// Document processing bookkeeping. Extraction lineage is recorded so a verified
// extraction can be reused, and a failure is recorded as a processing failure —
// never as taxpayer uncertainty.

export async function recordExtractionLineage(args: {
  documentId: string;
  signature: string;
  extractorA: string;
  extractorB: string;
}): Promise<void> {
  await db.document.update({
    where: { id: args.documentId },
    data: {
      extractionSchemaVersion: EXTRACTION_SCHEMA_VERSION,
      extractorVersionsJson: JSON.stringify({
        signature: args.signature,
        extractor_a: args.extractorA,
        extractor_b: args.extractorB,
      }),
    },
  });
}

export async function recordProcessingFailure(documentId: string, note: string): Promise<void> {
  await db.document.update({
    where: { id: documentId },
    data: {
      processingStatus: PROCESSING_STATUS.FAILED,
      processingNotesJson: JSON.stringify([note.slice(0, 500)]),
    },
  });
}
