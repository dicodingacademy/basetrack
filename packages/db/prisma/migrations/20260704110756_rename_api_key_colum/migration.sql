/*
  Warnings:

  - You are about to drop the column `desktopApiKey` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[apiKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_desktopApiKey_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "desktopApiKey",
ADD COLUMN     "apiKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");
