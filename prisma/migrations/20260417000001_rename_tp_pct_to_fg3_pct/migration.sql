-- Rename tpPct -> fg3Pct in PlayerSeasonAggregate to align DB column name with app convention.
ALTER TABLE "PlayerSeasonAggregate" RENAME COLUMN "tpPct" TO "fg3Pct";
