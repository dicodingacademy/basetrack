-- AlterTable
ALTER TABLE "User" ADD COLUMN "autoStopThresholdHours" INTEGER NOT NULL DEFAULT 8;

-- AlterEnum
ALTER TYPE "StopReason" ADD VALUE 'AUTO_STOPPED';

-- AlterEnum
ALTER TYPE "SyncStatus" ADD VALUE 'NEEDS_APPROVAL';
