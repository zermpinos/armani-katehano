-- Off/def rating is derived from the box score on read, so the stored columns go.

ALTER TABLE "Game"
  DROP COLUMN IF EXISTS "offRating",
  DROP COLUMN IF EXISTS "defRating";
