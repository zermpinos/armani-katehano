# Backup & Recovery Runbook

**Control:** ISO 27001 A.8.13 / A1.2
**Owner:** @armani-katehano
**Review cadence:** Quarterly (align with key-rotation schedule)

---

## Recovery objectives

| Objective | Target |
|---|---|
| RPO (Recovery Point Objective) | ≤ 24 hours (Neon PITR window; effectively minutes for recent data) |
| RTO (Recovery Time Objective) | ≤ 4 hours from incident declaration to verified production restore |

---

## Backup mechanism

Data is stored on **Neon** (PostgreSQL). Neon provides:

- **Automatic continuous WAL archiving** — no manual backup job required.
- **Point-in-time recovery (PITR)** — restore to any second within the retention window.
- **Branch-based restore** — spin up a database branch at a past timestamp without touching production.

### Confirming PITR is active

1. Log in to [console.neon.tech](https://console.neon.tech).
2. Select the **armani-katehano** project.
3. Go to **Settings → Storage** and confirm:
   - History retention is **≥ 7 days** (paid tier).
   - WAL archiving status shows **Active**.
4. Record the confirmed retention window in the drill log below.

> If the project is on the free tier, PITR retention is 1 day. Upgrade to paid to meet the 7-day RPO target.

---

## Schema recovery

Prisma migrations in `prisma/migrations/` are the authoritative schema history. In a full data-loss event, schema can be replayed against a blank database:

```sh
# Against a scratch DATABASE_URL
npx prisma migrate deploy
```

This does **not** restore data — it only reconstructs the schema.

---

## Restore procedure (data recovery)

### Step 1 — Declare the incident

Note the approximate time of data loss or corruption. This is your **restore target timestamp**.

### Step 2 — Create a Neon branch at the restore point

In the Neon console:

1. Go to **Branches → New branch**.
2. Set **Parent** to `main`.
3. Set **Point in time** to the timestamp just before the incident.
4. Name it `restore-YYYY-MM-DD` and create it.

Alternatively via the Neon CLI:

```sh
neonctl branches create \
  --project-id <PROJECT_ID> \
  --name restore-$(date +%F) \
  --parent main \
  --parent-timestamp "2026-01-01T12:00:00Z"
```

### Step 3 — Verify data on the branch

Connect to the branch's connection string and spot-check affected tables:

```sh
psql "<BRANCH_CONNECTION_STRING>" \
  -c "SELECT COUNT(*) FROM \"Game\";" \
  -c "SELECT COUNT(*) FROM \"Player\";"
```

Confirm the row counts and a sample of rows look correct.

### Step 4 — Promote or export

**Option A — promote branch to production** (fastest, replaces production DB endpoint):

In the Neon console, go to the branch → **Set as primary**. Update `DATABASE_URL` and `DIRECT_URL` in Vercel env vars if the endpoint hostname changed, then redeploy.

**Option B — selective row restore** (for partial corruption):

```sh
pg_dump "<BRANCH_CONNECTION_STRING>" \
  --table "Game" --table "Player" \
  --data-only --format=plain \
  | psql "<PRODUCTION_CONNECTION_STRING>"
```

Run only after confirming no FK violations in the target.

### Step 5 — Validate production

After restore:

1. Load the admin dashboard — confirm player list and game stats render correctly.
2. Check `prisma/migrations/` is still in sync: `npx prisma migrate status`.
3. Smoke-test the import endpoint with a known payload.

### Step 6 — Record the incident

Add a row to the **Incident log** section at the bottom of this file.

---

## Quarterly restore drill

Run this drill every quarter (same week as key rotation). The goal is to prove PITR works and the team can execute the procedure end-to-end.

### Drill checklist

- [ ] Log in to Neon console and confirm PITR retention window is ≥ 7 days.
- [ ] Create a branch at `NOW() - 1 hour` named `drill-YYYY-MM-DD`.
- [ ] Connect to the branch and verify row counts match production (within expected delta).
- [ ] Run `npx prisma migrate status` against the branch — confirm no pending migrations.
- [ ] Delete the drill branch after verification.
- [ ] Record results in the drill log below.

### Drill log

| Date | Performed by | PITR window confirmed | Branch row-count match | Notes |
|---|---|---|---|---|
| _(first drill pending)_ | | | | |

---

## Incident log

| Date | Description | Restore target | RTO achieved | Branch used | Notes |
|---|---|---|---|---|---|
| _(none)_ | | | | | |

---

## Out-of-scope

- `prisma/migrations/` tracks schema only — not row data. Migrations are not a data backup.
- Vercel serverless function logs are not covered by this runbook; use Vercel dashboard for log retention.
