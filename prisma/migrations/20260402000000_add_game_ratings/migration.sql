-- Add offensive and defensive rating columns to Game
ALTER TABLE "Game"
  ADD COLUMN IF NOT EXISTS "offRating" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "defRating" DOUBLE PRECISION;
