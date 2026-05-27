-- CreateTable
CREATE TABLE "BroadcastLog" (
    "id" TEXT NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "failedIds" TEXT[],
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentToAll" BOOLEAN NOT NULL,
    "targetIds" TEXT[],

    CONSTRAINT "BroadcastLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadcastLog_sentAt_idx" ON "BroadcastLog"("sentAt");
