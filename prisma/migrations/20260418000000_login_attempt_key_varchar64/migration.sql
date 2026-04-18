-- Widen ip column to hold SHA-256 hex keys (64 chars) used by all rate-limit buckets.
-- Previous VarChar(45) was sized for raw IPv6 but overflowed for subemail_<email> keys.
ALTER TABLE "LoginAttempt" ALTER COLUMN "ip" TYPE VARCHAR(64);
