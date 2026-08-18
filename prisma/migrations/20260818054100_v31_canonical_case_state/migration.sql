-- CreateTable
CREATE TABLE "CanonicalCaseState" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "stateJson" TEXT NOT NULL DEFAULT '{}',
    "stateHash" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'current',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanonicalCaseState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanonicalCaseStateSnapshot" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'analysis',
    "stateJson" TEXT NOT NULL DEFAULT '{}',
    "stateHash" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanonicalCaseStateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalCaseState_caseId_key" ON "CanonicalCaseState"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "CanonicalCaseStateSnapshot_caseId_version_key" ON "CanonicalCaseStateSnapshot"("caseId", "version");

-- AddForeignKey
ALTER TABLE "CanonicalCaseState" ADD CONSTRAINT "CanonicalCaseState_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanonicalCaseStateSnapshot" ADD CONSTRAINT "CanonicalCaseStateSnapshot_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
