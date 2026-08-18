-- CreateTable
CREATE TABLE "CaseDiscovery" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseVersion" INTEGER NOT NULL,
    "discoveryJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseDiscovery_caseId_caseVersion_key" ON "CaseDiscovery"("caseId", "caseVersion");

-- AddForeignKey
ALTER TABLE "CaseDiscovery" ADD CONSTRAINT "CaseDiscovery_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
