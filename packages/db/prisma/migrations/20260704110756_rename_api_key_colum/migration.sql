-- DropIndex
DROP INDEX IF EXISTS "User_desktopApiKey_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "desktopApiKey",
ADD COLUMN IF NOT EXISTS "apiKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_apiKey_key" ON "User"("apiKey");
