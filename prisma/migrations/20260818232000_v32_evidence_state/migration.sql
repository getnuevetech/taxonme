-- AlterTable: v3.2 document inventory + completeness metrics
ALTER TABLE "Document" ADD COLUMN "duplicateOfId" TEXT;
ALTER TABLE "Document" ADD COLUMN "documentFamily" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Document" ADD COLUMN "documentType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Document" ADD COLUMN "classificationConfidence" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Document" ADD COLUMN "taxPeriodsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Document" ADD COLUMN "pagesExpected" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "pagesProcessed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "tablesDetected" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "tablesProcessed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "transactionRowsDetected" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "transactionRowsExtracted" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "processingStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Document" ADD COLUMN "processingNotesJson" TEXT NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "Document_caseId_contentHash_idx" ON "Document"("caseId", "contentHash");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "EvidenceFact" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "documentId" TEXT,
    "factKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "factType" TEXT NOT NULL DEFAULT '',
    "valueText" TEXT NOT NULL DEFAULT '',
    "valueNumber" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT '',
    "taxPeriod" TEXT NOT NULL DEFAULT '',
    "effectiveDate" TIMESTAMP(3),
    "recordDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "provenance" TEXT NOT NULL DEFAULT 'MODEL_INFERENCE',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "sourcePage" INTEGER,
    "sourceField" TEXT NOT NULL DEFAULT '',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceFact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceFact_caseId_factKey_idx" ON "EvidenceFact"("caseId", "factKey");

-- CreateTable
CREATE TABLE "CaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "taxPeriod" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT 'UNCLASSIFIED_EVENT',
    "transactionCode" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "eventDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION,
    "balanceEffect" TEXT NOT NULL DEFAULT '',
    "sourceFactIdsJson" TEXT NOT NULL DEFAULT '[]',
    "provenance" TEXT NOT NULL DEFAULT 'DOCUMENT_EXTRACTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseEvent_caseId_taxPeriod_idx" ON "CaseEvent"("caseId", "taxPeriod");

-- CreateTable
CREATE TABLE "AccountPeriodState" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "taxPeriod" TEXT NOT NULL,
    "currentBalance" DOUBLE PRECISION,
    "currentBalanceAsOf" TIMESTAMP(3),
    "currentStatus" TEXT NOT NULL DEFAULT '',
    "stateJson" TEXT NOT NULL DEFAULT '{}',
    "supportingFactIdsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPeriodState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountPeriodState_caseId_taxPeriod_key" ON "AccountPeriodState"("caseId", "taxPeriod");

-- CreateTable
CREATE TABLE "EvidenceRelationship" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "fromTaxPeriod" TEXT NOT NULL DEFAULT '',
    "toTaxPeriod" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'POSSIBLE',
    "description" TEXT NOT NULL DEFAULT '',
    "supportingFactIdsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceRelationship_caseId_relationshipType_idx" ON "EvidenceRelationship"("caseId", "relationshipType");

-- CreateTable
CREATE TABLE "EvidenceAudit" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "analysisVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EVIDENCE_PROCESSING_INCOMPLETE',
    "documentsTotal" INTEGER NOT NULL DEFAULT 0,
    "documentsProcessed" INTEGER NOT NULL DEFAULT 0,
    "documentsVerified" INTEGER NOT NULL DEFAULT 0,
    "duplicatesResolved" INTEGER NOT NULL DEFAULT 0,
    "factsCompiled" INTEGER NOT NULL DEFAULT 0,
    "unknownsResolved" INTEGER NOT NULL DEFAULT 0,
    "unknownsRemaining" INTEGER NOT NULL DEFAULT 0,
    "reportJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenceAudit_caseId_createdAt_idx" ON "EvidenceAudit"("caseId", "createdAt");

-- CreateTable
CREATE TABLE "CaseReconstruction" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "analysisVersionId" TEXT,
    "reconstructionJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseReconstruction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseReconstruction_caseId_key" ON "CaseReconstruction"("caseId");

-- CreateTable
CREATE TABLE "CaseUnknown" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "unknownKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "question" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "materiality" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "resolvedValue" TEXT NOT NULL DEFAULT '',
    "supportingFactIdsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseUnknown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseUnknown_caseId_unknownKey_key" ON "CaseUnknown"("caseId", "unknownKey");

-- CreateTable
CREATE TABLE "SuppressedQuestion" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "question" TEXT NOT NULL DEFAULT '',
    "missingFact" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "supportingFactIdsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuppressedQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuppressedQuestion_caseId_questionKey_key" ON "SuppressedQuestion"("caseId", "questionKey");

-- AddForeignKey
ALTER TABLE "EvidenceFact" ADD CONSTRAINT "EvidenceFact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFact" ADD CONSTRAINT "EvidenceFact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseEvent" ADD CONSTRAINT "CaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountPeriodState" ADD CONSTRAINT "AccountPeriodState_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRelationship" ADD CONSTRAINT "EvidenceRelationship_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceAudit" ADD CONSTRAINT "EvidenceAudit_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseReconstruction" ADD CONSTRAINT "CaseReconstruction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseUnknown" ADD CONSTRAINT "CaseUnknown_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuppressedQuestion" ADD CONSTRAINT "SuppressedQuestion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
