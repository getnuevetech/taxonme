-- Case numbers (SERIAL backfills existing rows) and plan audience.
ALTER TABLE "Case" ADD COLUMN "number" SERIAL NOT NULL;
CREATE UNIQUE INDEX "Case_number_key" ON "Case"("number");
ALTER TABLE "SubscriptionPlan" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'customer';
