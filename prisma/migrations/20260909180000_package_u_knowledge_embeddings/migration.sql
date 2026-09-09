-- Package U: KnowledgeSource embedding fields for gated hybrid authority retrieval.
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "embeddingJson" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "embeddedAt" TIMESTAMP(3);
