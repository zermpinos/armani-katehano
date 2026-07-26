-- CreateTable
CREATE TABLE "ImportDraft" (
    "id" TEXT NOT NULL,
    "sourceUrl" VARCHAR(500) NOT NULL,
    "sourceKind" VARCHAR(40) NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "bytesHash" VARCHAR(64) NOT NULL,
    "gameId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportDraft_sourceUrl_key" ON "ImportDraft"("sourceUrl");

-- CreateIndex
CREATE INDEX "ImportDraft_createdAt_idx" ON "ImportDraft"("createdAt");
