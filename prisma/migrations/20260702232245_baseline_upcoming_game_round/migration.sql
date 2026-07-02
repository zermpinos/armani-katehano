-- Baseline migration: DB already had "round" column; this records it in the migration history.
ALTER TABLE "UpcomingGame" ADD COLUMN "round" TEXT NOT NULL DEFAULT 'regular';
