-- AlterTable
ALTER TABLE "ConsultantProfile" ADD COLUMN     "attestedCompliance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "efin" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "insurancePath" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "licenseState" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "photoIdPath" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
