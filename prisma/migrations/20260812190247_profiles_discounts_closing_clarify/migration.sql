-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedReason" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "closingRemarks" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ConsultantProfile" ADD COLUMN     "languages" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "website" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PlanDiscount" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentOff" INTEGER NOT NULL DEFAULT 0,
    "amountOffCents" INTEGER NOT NULL DEFAULT 0,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "emailsJson" TEXT NOT NULL DEFAULT '[]',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseClarifyMessage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseClarifyMessage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanDiscount" ADD CONSTRAINT "PlanDiscount_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseClarifyMessage" ADD CONSTRAINT "CaseClarifyMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
