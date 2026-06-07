-- Remove automatic game discovery: GameImportJob table, ImportJobState enum,
-- OpponentAlias table, and UpcomingGame.listingUrl column.
--
-- Broadcast-recap deduplication previously lived on GameImportJob.subscriberBroadcastAt.
-- It moves to Game.broadcastedAt so the manual recap-broadcast button still dedupes.

DROP TABLE IF EXISTS "GameImportJob";
DROP TYPE IF EXISTS "ImportJobState";
DROP TABLE IF EXISTS "OpponentAlias";
ALTER TABLE "UpcomingGame" DROP COLUMN IF EXISTS "listingUrl";
ALTER TABLE "Game" ADD COLUMN "broadcastedAt" TIMESTAMP(3);
