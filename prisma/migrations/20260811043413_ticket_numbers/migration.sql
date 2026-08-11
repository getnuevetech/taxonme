-- Add human-friendly sequential ticket numbers; SERIAL backfills existing rows.
ALTER TABLE "Ticket" ADD COLUMN "number" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");
