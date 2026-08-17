-- AlterTable
ALTER TABLE "AiProvider"
ADD COLUMN     "dataRetentionProfile" TEXT NOT NULL DEFAULT 'unreviewed',
ADD COLUMN     "regionProfile" TEXT NOT NULL DEFAULT 'unreviewed',
ADD COLUMN     "costTier" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN     "timeoutMs" INTEGER NOT NULL DEFAULT 90000;

-- AlterTable
ALTER TABLE "AiPrompt"
ADD COLUMN     "bodyHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "isReleased" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "supersedesPromptId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "AiPromptChange" (
    "id" TEXT NOT NULL,
    "promptRecordId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "fromHash" TEXT NOT NULL DEFAULT '',
    "toHash" TEXT NOT NULL DEFAULT '',
    "changeReason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPromptChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAnalysisVersion" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "trigger" TEXT NOT NULL DEFAULT 'analysis',
    "snapshotJson" TEXT NOT NULL DEFAULT '{}',
    "sourceSnapshotIdsJson" TEXT NOT NULL DEFAULT '[]',
    "issueIdsJson" TEXT NOT NULL DEFAULT '[]',
    "pathStepIdsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "CaseAnalysisVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "sourceRefsJson" TEXT NOT NULL DEFAULT '[]',
    "taxYearsJson" TEXT NOT NULL DEFAULT '[]',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFieldVerification" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "caseId" TEXT,
    "analysisVersionId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'candidate',
    "sourcesJson" TEXT NOT NULL DEFAULT '[]',
    "locationJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFieldVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanReviewItem" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "analysisVersionId" TEXT,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "HumanReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasePresentation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "analysisVersionId" TEXT,
    "schemaVersion" TEXT NOT NULL DEFAULT '3.0',
    "presentationJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasePresentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseReanalysisEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "pipelinesJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "actorType" TEXT NOT NULL DEFAULT 'system',
    "metadataJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CaseReanalysisEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseAnalysisVersion_caseId_version_key" ON "CaseAnalysisVersion"("caseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SourceSnapshot_snapshotHash_key" ON "SourceSnapshot"("snapshotHash");

-- AddForeignKey
ALTER TABLE "AiPromptChange" ADD CONSTRAINT "AiPromptChange_promptRecordId_fkey" FOREIGN KEY ("promptRecordId") REFERENCES "AiPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAnalysisVersion" ADD CONSTRAINT "CaseAnalysisVersion_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFieldVerification" ADD CONSTRAINT "DocumentFieldVerification_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFieldVerification" ADD CONSTRAINT "DocumentFieldVerification_analysisVersionId_fkey" FOREIGN KEY ("analysisVersionId") REFERENCES "CaseAnalysisVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReviewItem" ADD CONSTRAINT "HumanReviewItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanReviewItem" ADD CONSTRAINT "HumanReviewItem_analysisVersionId_fkey" FOREIGN KEY ("analysisVersionId") REFERENCES "CaseAnalysisVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePresentation" ADD CONSTRAINT "CasePresentation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePresentation" ADD CONSTRAINT "CasePresentation_analysisVersionId_fkey" FOREIGN KEY ("analysisVersionId") REFERENCES "CaseAnalysisVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseReanalysisEvent" ADD CONSTRAINT "CaseReanalysisEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
