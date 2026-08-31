-- Wave 7 / Phase −1.9: de-identified ExperienceObservation store with L7 telemetry.
CREATE TABLE IF NOT EXISTS "ExperienceObservation" (
    "id" TEXT NOT NULL,
    "sourceDigest" TEXT NOT NULL,
    "decisionTarget" TEXT NOT NULL DEFAULT '',
    "workspace" TEXT NOT NULL DEFAULT '',
    "promotionLevel" INTEGER NOT NULL DEFAULT 0,
    "anonJson" TEXT NOT NULL DEFAULT '{}',
    "sourceSituationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staleAt" TIMESTAMP(3),
    "staleReason" TEXT NOT NULL DEFAULT '',
    "helpCount" INTEGER NOT NULL DEFAULT 0,
    "harmCount" INTEGER NOT NULL DEFAULT 0,
    "lastServedAt" TIMESTAMP(3),
    CONSTRAINT "ExperienceObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ExperienceObservation_decisionTarget_promotionLevel_idx"
  ON "ExperienceObservation"("decisionTarget", "promotionLevel");
CREATE INDEX IF NOT EXISTS "ExperienceObservation_sourceDigest_idx"
  ON "ExperienceObservation"("sourceDigest");
CREATE INDEX IF NOT EXISTS "ExperienceObservation_sourceSituationId_idx"
  ON "ExperienceObservation"("sourceSituationId");
CREATE INDEX IF NOT EXISTS "ExperienceObservation_promotionLevel_staleAt_idx"
  ON "ExperienceObservation"("promotionLevel", "staleAt");

DO $$ BEGIN
  ALTER TABLE "ExperienceObservation"
    ADD CONSTRAINT "ExperienceObservation_sourceSituationId_fkey"
    FOREIGN KEY ("sourceSituationId") REFERENCES "Situation"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
