-- AlterTable: store minutes as decimal so seconds are preserved
ALTER TABLE "PlayerGameStat" ALTER COLUMN "minutes" TYPE double precision;
