-- Package N: persist ConversationIntelligence on Cases for clarify + admin continuity.
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "intelligenceJson" TEXT NOT NULL DEFAULT '{}';
