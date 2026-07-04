/*
  Warnings:

  - A unique constraint covering the columns `[desktopApiKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "desktopApiKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_desktopApiKey_key" ON "User"("desktopApiKey");
