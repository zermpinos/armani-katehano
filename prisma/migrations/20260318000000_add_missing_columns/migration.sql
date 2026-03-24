-- Migration applied manually via `prisma db push` on 2026-03-18.
-- Reconstructed from DB introspection for history completeness.
-- This SQL is ALREADY applied to the database. Do not re-run manually.

-- Game: add sourceUrl with partial unique index (NULL values not constrained)
ALTER TABLE "Game" ADD COLUMN "sourceUrl" TEXT;
CREATE UNIQUE INDEX "Game_sourceUrl_key" ON "Game"("sourceUrl") WHERE ("sourceUrl" IS NOT NULL);

-- PlayerSeasonAggregate: add shot totals and efficiency columns
ALTER TABLE "PlayerSeasonAggregate"
  ADD COLUMN "effAvg"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "fgmTotal"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fgaTotal"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fg2mTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fg2aTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fg3mTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fg3aTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ftmTotal"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ftaTotal"  INTEGER NOT NULL DEFAULT 0;
