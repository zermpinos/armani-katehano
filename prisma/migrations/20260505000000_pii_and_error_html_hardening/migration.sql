-- W-13: LoginAttempt.ip already stores SHA-256 hashes - no DDL change needed.
-- Retention is enforced at application layer (15-min window, cleanup cron).

-- W-14: Cap lastErrorHtml to 2 000 chars (plain-text digest, HTML stripped before storage).
-- Truncate any existing overlong values before constraining the column type.
UPDATE "GameImportJob"
SET "lastErrorHtml" = LEFT("lastErrorHtml", 2000)
WHERE "lastErrorHtml" IS NOT NULL AND LENGTH("lastErrorHtml") > 2000;

ALTER TABLE "GameImportJob"
  ALTER COLUMN "lastErrorHtml" TYPE VARCHAR(2000);
