/*
  Warnings:

  - Added the required column `basecampAccountId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: add with default first, backfill from basecampId (existing rows store account ID there), then drop default
ALTER TABLE "User" ADD COLUMN "basecampAccountId" TEXT NOT NULL DEFAULT '';
UPDATE "User" SET "basecampAccountId" = "basecampId";
ALTER TABLE "User" ALTER COLUMN "basecampAccountId" DROP DEFAULT;

-- Force re-login: existing basecampId values are org account IDs, not personal user IDs
DELETE FROM "Session";
