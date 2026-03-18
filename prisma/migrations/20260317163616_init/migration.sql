-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "height" TEXT,
    "weight" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizer" TEXT,
    "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonLeague" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonLeague_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "seasonLeagueId" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "location" TEXT,
    "teamScore" INTEGER NOT NULL,
    "opponentScore" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "playedOn" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonLeagueId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameStat" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "pts" INTEGER NOT NULL DEFAULT 0,
    "reb" INTEGER NOT NULL DEFAULT 0,
    "ast" INTEGER NOT NULL DEFAULT 0,
    "stl" INTEGER NOT NULL DEFAULT 0,
    "blk" INTEGER NOT NULL DEFAULT 0,
    "to" INTEGER NOT NULL DEFAULT 0,
    "pf" INTEGER NOT NULL DEFAULT 0,
    "fgm" INTEGER NOT NULL DEFAULT 0,
    "fga" INTEGER NOT NULL DEFAULT 0,
    "tpm" INTEGER NOT NULL DEFAULT 0,
    "tpa" INTEGER NOT NULL DEFAULT 0,
    "ftm" INTEGER NOT NULL DEFAULT 0,
    "fta" INTEGER NOT NULL DEFAULT 0,
    "plusMinus" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGameStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSeasonAggregate" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonLeagueId" TEXT NOT NULL,
    "gp" INTEGER NOT NULL DEFAULT 0,
    "ptsAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rebAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "astAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stlAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blkAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "toAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pfAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fgPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tpPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ftPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tsPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minutesAvg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ptsTotal" INTEGER NOT NULL DEFAULT 0,
    "rebTotal" INTEGER NOT NULL DEFAULT 0,
    "astTotal" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSeasonAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Season_name_key" ON "Season"("name");

-- CreateIndex
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonLeague_seasonId_leagueId_key" ON "SeasonLeague"("seasonId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_playerId_seasonLeagueId_key" ON "RosterEntry"("playerId", "seasonLeagueId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameStat_playerId_gameId_key" ON "PlayerGameStat"("playerId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonAggregate_playerId_seasonLeagueId_key" ON "PlayerSeasonAggregate"("playerId", "seasonLeagueId");

-- AddForeignKey
ALTER TABLE "SeasonLeague" ADD CONSTRAINT "SeasonLeague_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonLeague" ADD CONSTRAINT "SeasonLeague_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_seasonLeagueId_fkey" FOREIGN KEY ("seasonLeagueId") REFERENCES "SeasonLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_seasonLeagueId_fkey" FOREIGN KEY ("seasonLeagueId") REFERENCES "SeasonLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonAggregate" ADD CONSTRAINT "PlayerSeasonAggregate_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerSeasonAggregate" ADD CONSTRAINT "PlayerSeasonAggregate_seasonLeagueId_fkey" FOREIGN KEY ("seasonLeagueId") REFERENCES "SeasonLeague"("id") ON DELETE CASCADE ON UPDATE CASCADE;
