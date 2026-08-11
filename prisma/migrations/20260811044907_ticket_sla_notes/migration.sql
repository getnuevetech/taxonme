-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseAt" TIMESTAMP(3),
ADD COLUMN     "resolvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TicketMessage" ADD COLUMN     "internal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "system" BOOLEAN NOT NULL DEFAULT false;
