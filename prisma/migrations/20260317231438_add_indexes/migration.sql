CREATE INDEX "PlayerGameStat_gameId_idx"              ON "PlayerGameStat"("gameId");
CREATE INDEX "PlayerGameStat_playerId_idx"            ON "PlayerGameStat"("playerId");
CREATE INDEX "SeasonLeague_seasonId_idx"              ON "SeasonLeague"("seasonId");
CREATE INDEX "SeasonLeague_leagueId_idx"              ON "SeasonLeague"("leagueId");
CREATE INDEX "PlayerSeasonAggregate_seasonLeagueId_idx" ON "PlayerSeasonAggregate"("seasonLeagueId");
