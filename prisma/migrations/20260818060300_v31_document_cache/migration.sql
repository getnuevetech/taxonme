-- AlterTable
ALTER TABLE "Document"
ADD COLUMN     "contentHash" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "extractionSchemaVersion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "extractorVersionsJson" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "verificationStatus" TEXT NOT NULL DEFAULT 'unverified';
