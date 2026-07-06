/*
  Warnings:

  - You are about to drop the column `desktopApiKey` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TimerSource" AS ENUM ('BASECAMP', 'GOOGLE_CALENDAR', 'GOOGLE_TASKS');

-- DropIndex
DROP INDEX "User_desktopApiKey_key";

-- AlterTable
ALTER TABLE "ActiveTimer" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'BASECAMP';

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'BASECAMP';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "desktopApiKey";
