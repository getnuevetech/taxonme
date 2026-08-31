-- Wave 5 / Phase S: first-class Situation + PrepPlan; Case links to Situation; Document/QaThread optional situationId
CREATE TABLE IF NOT EXISTS "Situation" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "userId" TEXT,
    "guestSessionId" TEXT,
    "title" TEXT NOT NULL,
    "originalNarrative" TEXT NOT NULL DEFAULT '',
    "goal" TEXT NOT NULL DEFAULT '',
    "questionContractJson" TEXT NOT NULL DEFAULT '{}',
    "currentDecisionTarget" TEXT NOT NULL DEFAULT '',
    "knownFactsJson" TEXT NOT NULL DEFAULT '[]',
    "currentPathwaysJson" TEXT NOT NULL DEFAULT '[]',
    "currentRisksJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'open',
    "intelligenceJson" TEXT NOT NULL DEFAULT '{}',
    "learningEventJson" TEXT NOT NULL DEFAULT '{}',
    "assistantReply" TEXT NOT NULL DEFAULT '',
    "legacyCaseId" TEXT,
    "legacyRecordType" TEXT NOT NULL DEFAULT '',
    "migrationTimestamp" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Situation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Situation_number_key" ON "Situation"("number");
CREATE INDEX IF NOT EXISTS "Situation_userId_createdAt_idx" ON "Situation"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Situation_guestSessionId_idx" ON "Situation"("guestSessionId");

CREATE TABLE IF NOT EXISTS "PrepPlan" (
    "id" TEXT NOT NULL,
    "situationId" TEXT NOT NULL,
    "selectedPathway" TEXT NOT NULL DEFAULT '',
    "eligibilityJson" TEXT NOT NULL DEFAULT '{}',
    "blockersJson" TEXT NOT NULL DEFAULT '[]',
    "filingsJson" TEXT NOT NULL DEFAULT '[]',
    "evidenceNeedsJson" TEXT NOT NULL DEFAULT '[]',
    "sequenceJson" TEXT NOT NULL DEFAULT '[]',
    "preparationStatus" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrepPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrepPlan_situationId_idx" ON "PrepPlan"("situationId");

ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "situationId" TEXT;
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "governmentSystem" TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "Case_situationId_idx" ON "Case"("situationId");

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "situationId" TEXT;
CREATE INDEX IF NOT EXISTS "Document_situationId_idx" ON "Document"("situationId");

ALTER TABLE "QaThread" ADD COLUMN IF NOT EXISTS "situationId" TEXT;
CREATE INDEX IF NOT EXISTS "QaThread_situationId_idx" ON "QaThread"("situationId");

DO $$ BEGIN
  ALTER TABLE "Situation" ADD CONSTRAINT "Situation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Situation" ADD CONSTRAINT "Situation_guestSessionId_fkey" FOREIGN KEY ("guestSessionId") REFERENCES "GuestSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PrepPlan" ADD CONSTRAINT "PrepPlan_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "Situation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Case" ADD CONSTRAINT "Case_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "Situation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "Situation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QaThread" ADD CONSTRAINT "QaThread_situationId_fkey" FOREIGN KEY ("situationId") REFERENCES "Situation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
