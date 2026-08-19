-- Split readiness so our processing gaps are not deducted from the customer's case.
ALTER TABLE "Case" ADD COLUMN "evidenceAvailableScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Case" ADD COLUMN "evidenceProcessedScore" INTEGER NOT NULL DEFAULT 100;
