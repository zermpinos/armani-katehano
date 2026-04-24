-- CreateTable
CREATE TABLE "GameImportJob" (
  "id"             TEXT NOT NULL,
  "upcomingGameId" TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "gameId"         TEXT,
  "triggeredBy"    TEXT NOT NULL DEFAULT 'manual',
  "errorMessage"   TEXT,
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GameImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameImportJob_upcomingGameId_idx" ON "GameImportJob"("upcomingGameId");
CREATE INDEX "GameImportJob_status_idx" ON "GameImportJob"("status");

-- AddForeignKey
ALTER TABLE "GameImportJob" ADD CONSTRAINT "GameImportJob_upcomingGameId_fkey"
  FOREIGN KEY ("upcomingGameId") REFERENCES "UpcomingGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
