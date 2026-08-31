/**
 * Analysis-plan honesty helpers (Phase A INV-PLAN-01).
 * Skip reasons must not claim "options review / processing not needed" when docs exist.
 */

export function processDocumentsSkipReason(input: {
  openOptions?: boolean;
  documentCount: number;
}): string {
  if (input.documentCount > 0) {
    return "Documents already processed and current";
  }
  if (input.openOptions) {
    return "Options review — no documents uploaded yet";
  }
  return "No documents to process";
}
