-- CreateTable
CREATE TABLE "UpcomingGame" (
    "id"             TEXT NOT NULL,
    "opponent"       TEXT NOT NULL,
    "scheduledFor"   TIMESTAMP(3) NOT NULL,
    "location"       TEXT NOT NULL DEFAULT 'home',
    "competition"    TEXT,
    "notes"          TEXT,
    "seasonLeagueId" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpcomingGame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UpcomingGame_scheduledFor_idx" ON "UpcomingGame"("scheduledFor");

-- CreateTable
CREATE TABLE "GameRosterAnnouncement" (
    "id"             TEXT NOT NULL,
    "upcomingGameId" TEXT NOT NULL,
    "message"        TEXT,
    "publishedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameRosterAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameRosterAnnouncement_upcomingGameId_key" ON "GameRosterAnnouncement"("upcomingGameId");

-- AddForeignKey
ALTER TABLE "GameRosterAnnouncement" ADD CONSTRAINT "GameRosterAnnouncement_upcomingGameId_fkey"
    FOREIGN KEY ("upcomingGameId") REFERENCES "UpcomingGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "GameRosterPlayer" (
    "id"             TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "playerId"       TEXT NOT NULL,
    "note"           TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRosterPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameRosterPlayer_announcementId_playerId_key" ON "GameRosterPlayer"("announcementId", "playerId");

-- CreateIndex
CREATE INDEX "GameRosterPlayer_announcementId_idx" ON "GameRosterPlayer"("announcementId");

-- AddForeignKey
ALTER TABLE "GameRosterPlayer" ADD CONSTRAINT "GameRosterPlayer_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "GameRosterAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameRosterPlayer" ADD CONSTRAINT "GameRosterPlayer_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Setting" (
    "key"       TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
