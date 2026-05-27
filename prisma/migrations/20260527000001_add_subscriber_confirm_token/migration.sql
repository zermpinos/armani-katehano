-- AlterTable
ALTER TABLE "Subscriber" ADD COLUMN     "confirmToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_confirmToken_key" ON "Subscriber"("confirmToken");
