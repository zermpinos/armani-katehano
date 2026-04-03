-- Add YouTube replay URL to Game
ALTER TABLE "Game"
  ADD COLUMN IF NOT EXISTS "youtubeUrl" TEXT;
