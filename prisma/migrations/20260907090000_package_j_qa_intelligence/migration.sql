-- Package J: persist ConversationIntelligence on Q&A threads for contract continuity.
ALTER TABLE "QaThread" ADD COLUMN IF NOT EXISTS "intelligenceJson" TEXT NOT NULL DEFAULT '{}';
