/*
  Warnings:

  - You are about to drop the column `autoStopThresholdHours` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "autoStopThresholdHours",
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta';

-- CreateTable
CREATE TABLE "AutoStopRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT,
    "conditions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoStopRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoStopRule_userId_idx" ON "AutoStopRule"("userId");

-- AddForeignKey
ALTER TABLE "AutoStopRule" ADD CONSTRAINT "AutoStopRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
