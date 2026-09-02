ALTER TABLE "PlayerGameStat" ADD COLUMN "played" BOOLEAN NOT NULL DEFAULT false;

-- "did this player play" was minutes > 0 until a source that publishes no
-- minutes existed, so backfilling with that exact predicate leaves every
-- existing aggregate unchanged.
UPDATE "PlayerGameStat" SET "played" = true WHERE "minutes" > 0;

-- Null now means the source published nothing, which is different from a
-- player who really averaged zero. The default is dropped so a write that
-- omits the column records "unknown" rather than a fabricated 0.
ALTER TABLE "PlayerSeasonAggregate" ALTER COLUMN "minutesAvg" DROP NOT NULL;
ALTER TABLE "PlayerSeasonAggregate" ALTER COLUMN "minutesAvg" DROP DEFAULT;
ALTER TABLE "PlayerSeasonAggregate" ALTER COLUMN "pfAvg"      DROP NOT NULL;
ALTER TABLE "PlayerSeasonAggregate" ALTER COLUMN "pfAvg"      DROP DEFAULT;

-- Per-league jersey override. Null falls back to Player.number.
ALTER TABLE "RosterEntry" ADD COLUMN "number" INTEGER;
