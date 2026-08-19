import crypto from "crypto";
import { PROCESSING_STATUS } from "./types";

// Verified extraction is reusable. A document is only re-read when its content,
// the extraction schema, or the extractor lineup actually changed.

export const EXTRACTION_SCHEMA_VERSION = "3.2";

export type ExtractorStep = { role: string; promptId: string; provider: { name: string; model: string } };

export function extractorSignature(steps: ExtractorStep[]): string {
  const lineup = steps
    .map((step) => `${step.role}:${step.promptId}:${step.provider.name}:${step.provider.model}`)
    .sort()
    .join("|");
  return crypto.createHash("sha256").update(`${EXTRACTION_SCHEMA_VERSION}::${lineup}`).digest("hex").slice(0, 32);
}

export type CacheableDocument = {
  contentHash: string;
  extractionSchemaVersion: string;
  extractorVersionsJson: string;
  verificationStatus: string;
  processingStatus: string;
};

export function isExtractionCacheValid(doc: CacheableDocument, signature: string): boolean {
  if (!doc.contentHash) return false;
  if (doc.extractionSchemaVersion !== EXTRACTION_SCHEMA_VERSION) return false;
  if (doc.processingStatus === PROCESSING_STATUS.FAILED) return false;
  if (doc.verificationStatus === "unverified") return false;
  try {
    const stored = JSON.parse(doc.extractorVersionsJson || "{}");
    return stored?.signature === signature;
  } catch {
    return false;
  }
}

// Text we already extracted stays usable even if the stored file later becomes
// unreadable — losing the file must not erase the evidence taken from it.
export function storedRawText(extractedJson: string): string {
  try {
    const parsed = JSON.parse(extractedJson || "{}");
    return typeof parsed?.raw_text === "string" ? parsed.raw_text : "";
  } catch {
    return "";
  }
}

// Page accounting from the document's own text. When the document does not say
// how many pages it has we record what we processed rather than guessing.
export function countPages(text: string): { expected: number; processed: number } {
  if (!text.trim()) return { expected: 0, processed: 0 };
  const declared = text.match(/page\s+\d+\s+of\s+(\d+)/i);
  const formFeeds = (text.match(/\f/g) ?? []).length;
  const processed = formFeeds > 0 ? formFeeds + 1 : 1;
  const expected = declared ? Number(declared[1]) : processed;
  return { expected: Number.isFinite(expected) ? expected : processed, processed };
}
