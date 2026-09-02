ALTER TABLE "League" ADD COLUMN "organization" TEXT;
ALTER TABLE "League" ADD COLUMN "sourceSlug"   TEXT;
ALTER TABLE "League" ADD COLUMN "listingUrl"   TEXT;

-- sourceSlug keeps what the source URL calls the competition, which is what a
-- scraped URL matches on. slug becomes ours alone and moves into public URLs,
-- so the two can drift without breaking imports.
UPDATE "League" SET "organization" = 'basketcity', "sourceSlug" = "slug";
UPDATE "League" SET "slug" = 'basketcity-' || "slug";

ALTER TABLE "League" ALTER COLUMN "organization" SET NOT NULL;
