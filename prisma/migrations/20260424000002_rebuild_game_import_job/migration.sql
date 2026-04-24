-- Drop skeleton table from previous migration
DROP TABLE IF EXISTS "GameImportJob";

-- CreateEnum
CREATE TYPE "ImportJobState" AS ENUM ('PENDING', 'IMPORTED', 'ERROR', 'ABANDONED');

-- CreateTable
CREATE TABLE "GameImportJob" (
  "id"             TEXT NOT NULL,
  "upcomingGameId" TEXT NOT NULL,
  "sourceUrl"      TEXT,
  "state"          "ImportJobState" NOT NULL DEFAULT 'PENDING',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt"  TIMESTAMP(3),
  "lockedAt"       TIMESTAMP(3),
  "lockedBy"       TEXT,
  "importedGameId" TEXT,
  "importedAt"     TIMESTAMP(3),
  "lastError"      TEXT,
  "lastErrorHtml"  TEXT,
  "warningSentAt"  TIMESTAMP(3),
  "successSentAt"  TIMESTAMP(3),
  "failureSentAt"  TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GameImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameImportJob_upcomingGameId_key" ON "GameImportJob"("upcomingGameId");
CREATE UNIQUE INDEX "GameImportJob_importedGameId_key" ON "GameImportJob"("importedGameId");
CREATE INDEX "GameImportJob_state_idx" ON "GameImportJob"("state");

-- AddForeignKey
ALTER TABLE "GameImportJob" ADD CONSTRAINT "GameImportJob_upcomingGameId_fkey"
  FOREIGN KEY ("upcomingGameId") REFERENCES "UpcomingGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GameImportJob" ADD CONSTRAINT "GameImportJob_importedGameId_fkey"
  FOREIGN KEY ("importedGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
