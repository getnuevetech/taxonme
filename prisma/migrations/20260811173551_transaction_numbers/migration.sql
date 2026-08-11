ALTER TABLE "PaymentTransaction" ADD COLUMN "number" SERIAL NOT NULL;
CREATE UNIQUE INDEX "PaymentTransaction_number_key" ON "PaymentTransaction"("number");
