-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Response_callId_questionKey_key" ON "Response"("callId", "questionKey");
