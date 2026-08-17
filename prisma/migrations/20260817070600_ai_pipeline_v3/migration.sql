-- CreateTable
CREATE TABLE "AiPrompt" (
    "id" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "responsibility" TEXT NOT NULL DEFAULT '',
    "stageKey" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL DEFAULT '3.0',
    "schemaVersion" TEXT NOT NULL DEFAULT '3.0',
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiPrompt_promptId_key" ON "AiPrompt"("promptId");

-- AlterTable
ALTER TABLE "PipelineStage"
ADD COLUMN     "version" TEXT NOT NULL DEFAULT '1.0',
ADD COLUMN     "reviewerRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sourceRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PipelineStep"
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'sequential',
ADD COLUMN     "routeKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "promptId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "promptVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "schemaVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pipelineVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "isConditional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "conditionsJson" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "AnalysisRun"
ADD COLUMN     "caseAnalysisVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "pipelineVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "schemaVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sourceSnapshotId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "metadataJson" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "AnalysisStepResult"
ADD COLUMN     "promptId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "promptVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "schemaVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "providerRoute" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "modelRoute" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "qualityGate" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "errorCode" TEXT NOT NULL DEFAULT '';
