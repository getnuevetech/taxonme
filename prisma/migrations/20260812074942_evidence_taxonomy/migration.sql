-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "conflictsJson" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "altAction" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "conclusion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "evidenceStatus" TEXT NOT NULL DEFAULT 'needs_verification',
ADD COLUMN     "evidenceStrength" TEXT NOT NULL DEFAULT 'limited',
ADD COLUMN     "explanationsJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "itemKind" TEXT NOT NULL DEFAULT 'issue',
ADD COLUMN     "unclearJson" TEXT NOT NULL DEFAULT '[]';
