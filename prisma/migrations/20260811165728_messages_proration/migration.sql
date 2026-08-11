-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "interval" TEXT NOT NULL DEFAULT 'monthly';

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'event',
    "offsetDays" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_dedupeKey_key" ON "MessageLog"("dedupeKey");

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_templateKey_fkey" FOREIGN KEY ("templateKey") REFERENCES "MessageTemplate"("key") ON DELETE CASCADE ON UPDATE CASCADE;
