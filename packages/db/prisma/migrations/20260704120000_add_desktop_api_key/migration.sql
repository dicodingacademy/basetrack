-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "desktopApiKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_desktopApiKey_key" ON "User"("desktopApiKey");
