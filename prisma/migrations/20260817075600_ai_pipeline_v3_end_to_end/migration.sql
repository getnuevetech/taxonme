-- AlterTable
ALTER TABLE "AiProvider"
ADD COLUMN     "supportsStructuredOutput" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxContextTokens" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AnalysisStepResult"
ADD COLUMN     "inputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "outputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedCostMicros" INTEGER NOT NULL DEFAULT 0;
