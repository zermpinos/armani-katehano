-- Add contactEmail to Player
ALTER TABLE "Player" ADD COLUMN "contactEmail" TEXT;

-- PlayerCredential
CREATE TABLE "PlayerCredential" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerCredential_playerId_key" ON "PlayerCredential"("playerId");
CREATE UNIQUE INDEX "PlayerCredential_username_key" ON "PlayerCredential"("username");

ALTER TABLE "PlayerCredential"
    ADD CONSTRAINT "PlayerCredential_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PlayerInvite
CREATE TABLE "PlayerInvite" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerInvite_tokenHash_key" ON "PlayerInvite"("tokenHash");
CREATE INDEX "PlayerInvite_playerId_idx" ON "PlayerInvite"("playerId");
CREATE INDEX "PlayerInvite_expiresAt_idx" ON "PlayerInvite"("expiresAt");

ALTER TABLE "PlayerInvite"
    ADD CONSTRAINT "PlayerInvite_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
