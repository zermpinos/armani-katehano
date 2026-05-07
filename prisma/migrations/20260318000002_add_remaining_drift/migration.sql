-- Applied directly to DB without a migration file; captured here for history completeness.

-- Game: playedOn index
CREATE INDEX "Game_playedOn_idx" ON "Game"("playedOn");

-- PlayerSeasonAggregate: createdAt and stlTotal (missed in 20260318000000_add_missing_columns)
ALTER TABLE "PlayerSeasonAggregate"
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "stlTotal"  INTEGER NOT NULL DEFAULT 0;
