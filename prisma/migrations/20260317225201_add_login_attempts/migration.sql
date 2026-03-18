CREATE TABLE "LoginAttempt" (
  "id"          TEXT NOT NULL,
  "ip"          VARCHAR(45) NOT NULL,
  "attemptedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LoginAttempt_ip_attemptedAt_idx" ON "LoginAttempt"("ip", "attemptedAt");
