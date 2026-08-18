-- AlterTable
ALTER TABLE "CaseReanalysisEvent" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CaseReanalysisEvent_idempotencyKey_active_key"
ON "CaseReanalysisEvent"("idempotencyKey")
WHERE "idempotencyKey" IS NOT NULL AND "status" IN ('queued', 'running');
