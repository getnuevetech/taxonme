-- AlterTable
ALTER TABLE "ConsultantAssignment" ADD COLUMN     "autoAssigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reasonDetail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reasonSummary" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ConsultantProfile" ADD COLUMN     "experiences" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "QaThread" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'qa';

-- CreateTable
CREATE TABLE "ConsultantPastCase" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "outcome" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultantPastCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'customer_service',
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL DEFAULT '',
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConsultantPastCase" ADD CONSTRAINT "ConsultantPastCase_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ConsultantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
