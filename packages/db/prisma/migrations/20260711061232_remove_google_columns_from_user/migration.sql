/*
  Warnings:

  - You are about to drop the column `googleAccessToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `googleRefreshToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `googleTokenExpiresAt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "googleAccessToken",
DROP COLUMN "googleRefreshToken",
DROP COLUMN "googleTokenExpiresAt";
