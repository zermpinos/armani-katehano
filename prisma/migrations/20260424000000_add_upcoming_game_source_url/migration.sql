-- AlterTable
ALTER TABLE "UpcomingGame" ADD COLUMN "sourceUrl" TEXT;

-- CreateIndex (partial unique — null values are excluded)
CREATE UNIQUE INDEX "UpcomingGame_sourceUrl_key"
  ON "UpcomingGame" ("sourceUrl")
  WHERE ("sourceUrl" IS NOT NULL);
