-- CreateTable
CREATE TABLE "CaseIssueCluster" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "analysisVersionId" TEXT,
    "clusterKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'UNCLASSIFIED_TAX_ISSUE',
    "status" TEXT NOT NULL DEFAULT 'NEEDS_VERIFICATION',
    "evidenceStrength" TEXT NOT NULL DEFAULT 'LIMITED',
    "issueIdsJson" TEXT NOT NULL DEFAULT '[]',
    "unknownsJson" TEXT NOT NULL DEFAULT '[]',
    "possibleExplanationsJson" TEXT NOT NULL DEFAULT '[]',
    "actionsJson" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseIssueCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseActionNode" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "normalizedPurpose" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "dependsOnJson" TEXT NOT NULL DEFAULT '[]',
    "resolvesJson" TEXT NOT NULL DEFAULT '[]',
    "requiresJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseActionNode_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CaseIssueCluster" ADD CONSTRAINT "CaseIssueCluster_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseActionNode" ADD CONSTRAINT "CaseActionNode_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
