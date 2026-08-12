-- AlterTable
ALTER TABLE "IrsFormTemplate" ADD COLUMN     "pdfMapJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "pdfPath" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pdfSourceUrl" TEXT NOT NULL DEFAULT '';
