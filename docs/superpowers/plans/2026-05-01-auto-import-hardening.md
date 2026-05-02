# Auto-Import Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the automatic game-import pipeline observable, recoverable, and aware of admin opponent-naming conventions, without changing the existing happy-path behavior.

**Architecture:** Five layered improvements over the existing pipeline (GitHub Actions hourly cron → `/api/cron/discover-and-import` → `discoverSourceUrl` → `processJob`). Adds two persistent tables (`CronRun` for run-history audit; `OpponentAlias` for matcher dictionary), a daily heartbeat email cron, and a series of in-handler hardening fixes (timing-safe auth compare, transient-vs-genuine error distinction, comprehensive audit logging on every previously-silent path, expose RESET on IMPORTED jobs).

**Tech Stack:** Next.js 14 Pages Router, TypeScript, Prisma 7.8, Postgres, Vitest, Brevo SMTP via nodemailer, GitHub Actions hourly cron, Vercel scheduled cron.

---

## Audit findings answered (decisions locked in before this plan)

| ID | Decision | Source |
|---|---|---|
| H1 | Nothing silent — log every skip; surface in heartbeat | user |
| H2 | ERROR-with-sourceUrl: log + heartbeat. No auto-recovery (mirrors H4 stance) | user |
| H3 | maxDuration cap is sufficient (≤1 candidate per run typical) | user |
| H4 | Manual reset required on Game deletion. Add admin note. | user |
| L5 | Sportstats publishes ≤1 h after game ends. 4 attempts is correct. | user |
| L2 | Build a global `OpponentAlias` table; matcher tries alias *in addition to* original (more lenient) | user |
| M1 | Daily heartbeat at `5 5 * * *` UTC, includes next-7-days schedule | user |
| Step 2 data source | `CronRun` table (more reliable than reading audit-log files) | user |

---

## File Structure

### Created
- `prisma/migrations/<ts>_add_cron_run/migration.sql`
- `prisma/migrations/<ts>_add_opponent_alias/migration.sql`
- `src/server/services/cron-run.ts` — small helper to record cron run summaries
- `src/schemas/opponent-alias.ts` — Zod validation
- `src/server/integrations/email/templates/import-heartbeat.ts` — heartbeat email builder
- `pages/api/cron/import-heartbeat.ts` — daily cron handler
- `pages/api/admin/opponent-aliases/[[...params]].ts` — REST CRUD
- `pages/admin/[slug]/opponent-aliases.tsx` — admin UI
- `tests/unit/server/services/cron-run.test.ts`
- `tests/unit/server/api/import-heartbeat.test.ts`
- `tests/unit/server/api/opponent-aliases.test.ts`

### Modified
- `vercel.json` — `maxDuration` on discover-and-import; new heartbeat cron entry
- `prisma/schema.prisma` — add `CronRun` and `OpponentAlias` models; rename `UpcomingGame.importJobs` → `importJob` (singular optional)
- `pages/api/cron/discover-and-import.ts` — timing-safe auth, audit-log every silent path, transient-vs-genuine error split, thread match reason into emails, write CronRun summary, adapt to renamed relation
- `src/server/services/discover-source-url.ts` — alias lookup before fuzzy match
- `src/server/integrations/email/client.ts` — add `sendImportHeartbeat`
- `src/server/integrations/email/templates/index.ts` — re-export `buildImportHeartbeat`
- `pages/admin/[slug]/schedule.tsx` — admin notes + expose RESET for IMPORTED state; adapt to renamed relation
- `pages/api/admin/schedule.ts` — adapt to renamed relation
- `src/server/services/import-game.ts` — adapt to renamed relation
- `tests/unit/server/api/discover-and-import.test.ts` — coverage for new audit-log entries; adapt to renamed relation
- `tests/unit/server/services/discover-source-url.test.ts` — alias hit/miss tests
- `tests/integration/server/services/import-job.test.ts` → renamed to `tests/unit/server/services/import-job.test.ts`

---

## Phase 1 — Quick wins (no schema, low risk)

### Task 1: Cap function duration on the discover cron

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Edit `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/purge-subscribers",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/purge-error-html",
      "schedule": "0 4 * * *"
    }
  ],
  "functions": {
    "pages/api/cron/discover-and-import.ts": {
      "maxDuration": 60
    }
  }
}
```

- [ ] **Step 2: Verify the JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore(cron): cap discover-and-import maxDuration at 60s"
```

---

### Task 2: Constant-time Bearer-token compare

**Files:**
- Modify: `pages/api/cron/discover-and-import.ts:38-41`
- Test: `tests/unit/server/api/discover-and-import.test.ts` (existing auth describe block)

- [ ] **Step 1: Add test for header-length mismatch (would crash a naive `timingSafeEqual`)**

Append to the `describe("auth", ...)` block in `tests/unit/server/api/discover-and-import.test.ts`:

```ts
it("returns 401 when Authorization header is shorter than expected (no crash)", async () => {
  const res = mockRes();
  await handler(mockReq({ headers: { authorization: "Bearer x" } }) as any, res as any);
  expect(res.statusCode).toBe(401);
});

it("returns 401 when Authorization header is empty", async () => {
  const res = mockRes();
  await handler(mockReq({ headers: { authorization: "" } }) as any, res as any);
  expect(res.statusCode).toBe(401);
});
```

- [ ] **Step 2: Run tests; expect existing ones still pass and new ones already pass (string `!==` works)**

Run: `npx vitest run tests/unit/server/api/discover-and-import.test.ts -t "auth"`
Expected: PASS for all auth tests.

- [ ] **Step 3: Refactor to `timingSafeEqual`**

In `pages/api/cron/discover-and-import.ts`, replace lines 38-41 with:

```ts
import { timingSafeEqual } from "node:crypto";

// ...

const cronSecret = process.env.CRON_SECRET;
const authHeader = String(req.headers["authorization"] ?? "");
const expected   = `Bearer ${cronSecret ?? ""}`;
if (
  !cronSecret ||
  authHeader.length !== expected.length ||
  !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
) {
  return res.status(401).json({ error: "Unauthorized" });
}
```

(Add the `timingSafeEqual` import at the top alongside the other imports.)

- [ ] **Step 4: Run all auth tests**

Run: `npx vitest run tests/unit/server/api/discover-and-import.test.ts -t "auth"`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add pages/api/cron/discover-and-import.ts tests/unit/server/api/discover-and-import.test.ts
git commit -m "fix(cron): use timingSafeEqual for CRON_SECRET compare"
```

---

### Task 3: Audit-log every silent skip path

**Files:**
- Modify: `pages/api/cron/discover-and-import.ts` (handleCandidate)
- Test: `tests/unit/server/api/discover-and-import.test.ts`

Background: today the handler silently swallows four cases — ABANDONED job, ERROR-with-sourceUrl, missing listingUrl, max-tries-exhausted. The user requirement is "nothing silent." Add `auditLog("discover_skip", { reason, ... })` in each branch.

- [ ] **Step 1: Add a test asserting an audit-log entry is emitted for the no-listing-url case**

Append inside `describe("backoff timing", ...)` in `tests/unit/server/api/discover-and-import.test.ts`:

```ts
it("logs an audit entry when a game has no listingUrl", async () => {
  const { auditLog } = await import("@/server/security/node");
  const game = makeGame({
    scheduledFor: new Date(NOW.getTime() - 2 * HOUR),
    listingUrl:   null,
  });
  mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

  const res = mockRes();
  await handler(mockReq() as any, res as any);

  expect(vi.mocked(auditLog)).toHaveBeenCalledWith(
    "discover_skip",
    expect.objectContaining({ reason: "no-listing-url", upcomingGameId: "game1" })
  );
});

it("logs an audit entry for an ERROR job with sourceUrl already set", async () => {
  const { auditLog } = await import("@/server/security/node");
  const job  = { id: "jobA", state: "ERROR", attempts: 3, failureSentAt: new Date() };
  const game = makeGame({
    scheduledFor: new Date(NOW.getTime() - 5 * HOUR),
    sourceUrl:    "https://basketcity.sportstats.gr/men/gamedetails/id/STUCK",
    importJobs:   [job],
  });
  mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

  const res = mockRes();
  await handler(mockReq() as any, res as any);

  expect(vi.mocked(auditLog)).toHaveBeenCalledWith(
    "discover_skip",
    expect.objectContaining({ reason: "job-state-ERROR", upcomingGameId: "game1" })
  );
});

it("logs an audit entry when MAX_DISCOVERY_TRIES has been exhausted", async () => {
  const { auditLog } = await import("@/server/security/node");
  const job  = { id: "jobA", state: "PENDING", attempts: 4, failureSentAt: null };
  const game = makeGame({
    scheduledFor: new Date(NOW.getTime() - 5 * HOUR),
    importJobs:   [job],
  });
  mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

  const res = mockRes();
  await handler(mockReq() as any, res as any);

  expect(vi.mocked(auditLog)).toHaveBeenCalledWith(
    "discover_skip",
    expect.objectContaining({ reason: "max-tries-exhausted", upcomingGameId: "game1" })
  );
});
```

- [ ] **Step 2: Run; expect failures**

Run: `npx vitest run tests/unit/server/api/discover-and-import.test.ts -t "logs an audit entry"`
Expected: 3 FAIL.

- [ ] **Step 3: Implement the audit-log calls in `pages/api/cron/discover-and-import.ts`**

Replace the body of `handleCandidate` (lines 89-172) so every previously-silent return is preceded by an `auditLog("discover_skip", ...)` call:

```ts
async function handleCandidate(
  game:    Candidate,
  now:     Date,
  summary: RunSummary,
): Promise<boolean> {
  const job = game.importJobs[0] ?? null;

  if (job?.state === "ABANDONED") {
    auditLog("discover_skip", {
      reason:         "abandoned",
      upcomingGameId: game.id,
      opponent:       game.opponent,
    });
    return false;
  }

  // sourceUrl already known → straight to processJob
  if (game.sourceUrl) {
    const ensuredJob = job
      ?? await prisma.gameImportJob.create({
        data: { upcomingGameId: game.id, sourceUrl: game.sourceUrl, state: "PENDING" },
      });
    if (ensuredJob.state === "PENDING") {
      await processJob(ensuredJob.id);
      const after = await prisma.gameImportJob.findUniqueOrThrow({ where: { id: ensuredJob.id } });
      if (after.state === "IMPORTED") summary.imported++;
    } else {
      auditLog("discover_skip", {
        reason:         `job-state-${ensuredJob.state}`,
        upcomingGameId: game.id,
        opponent:       game.opponent,
        jobId:          ensuredJob.id,
      });
    }
    return true;
  }

  if (!game.listingUrl) {
    auditLog("discover_skip", {
      reason:         "no-listing-url",
      upcomingGameId: game.id,
      opponent:       game.opponent,
    });
    return false;
  }

  const attempts = job?.attempts ?? 0;
  if (attempts >= MAX_DISCOVERY_TRIES) {
    auditLog("discover_skip", {
      reason:         "max-tries-exhausted",
      upcomingGameId: game.id,
      opponent:       game.opponent,
      attempts,
    });
    return false;
  }

  const dueAt = new Date(game.scheduledFor.getTime() + (attempts + 1) * HOUR_MS);
  if (dueAt > now) return false; // intentionally NOT logged — fires every hour

  let discovered: Awaited<ReturnType<typeof discoverSourceUrl>>;
  try {
    discovered = await discoverSourceUrl({
      listingUrl:   game.listingUrl,
      scheduledFor: game.scheduledFor,
      opponent:     game.opponent,
    });
  } catch (err) {
    const reason = err instanceof ListingFetchError ? err.message : (err as Error).message;
    await recordDiscoveryMiss(game, job, reason, attempts + 1, summary, /*transient*/ err instanceof ListingFetchError);
    return true;
  }

  if (!discovered.gameUrl) {
    await recordDiscoveryMiss(game, job, discovered.reason, attempts + 1, summary, false);
    return true;
  }

  // Found — promote to a normal import
  await prisma.upcomingGame.update({
    where: { id: game.id },
    data:  { sourceUrl: discovered.gameUrl },
  });

  const liveJob = job
    ? await prisma.gameImportJob.update({
        where: { id: job.id },
        data:  {
          sourceUrl:     discovered.gameUrl,
          state:         "PENDING",
          attempts:      0,
          lockedAt:      null,
          lockedBy:      null,
          lastError:     null,
          lastAttemptAt: new Date(),
        },
      })
    : await prisma.gameImportJob.create({
        data: { upcomingGameId: game.id, sourceUrl: discovered.gameUrl, state: "PENDING" },
      });

  summary.discovered++;
  auditLog("discover_source_url_match", {
    upcomingGameId: game.id,
    opponent:       game.opponent,
    gameUrl:        discovered.gameUrl,
    matchReason:    discovered.reason,
  });

  await processJob(liveJob.id);
  const after = await prisma.gameImportJob.findUniqueOrThrow({ where: { id: liveJob.id } });
  if (after.state === "IMPORTED") summary.imported++;
  return true;
}
```

(The `transient` parameter is wired into Task 4. For now it can be `false` everywhere — Task 4 will use it.)

- [ ] **Step 4: Run the new audit tests**

Run: `npx vitest run tests/unit/server/api/discover-and-import.test.ts`
Expected: PASS for all (existing + new). The 3 new audit-entry tests should PASS.

- [ ] **Step 5: Commit**

```bash
git add pages/api/cron/discover-and-import.ts tests/unit/server/api/discover-and-import.test.ts
git commit -m "feat(cron): audit-log every silent skip path in discover-and-import"
```

---

### Task 4: Distinguish transient listing failures from genuine misses

**Files:**
- Modify: `pages/api/cron/discover-and-import.ts` (recordDiscoveryMiss signature + body)
- Test: `tests/unit/server/api/discover-and-import.test.ts`

Background: a single Cloudflare 502 currently increments `attempts`, burning one of 4 hours. Genuine misses (parsed listing OK, no row matches) keep counting; transient failures (network error, 5xx, redirect) do not.

- [ ] **Step 1: Add a test for transient-error attempts NOT incremented**

Append inside `describe("discovery outcomes", ...)`:

```ts
it("does not increment attempts on a transient ListingFetchError", async () => {
  const job  = { id: "jobA", state: "PENDING", attempts: 1, failureSentAt: null };
  const game = makeGame({
    scheduledFor: new Date(NOW.getTime() - 2 * HOUR),
    importJobs:   [job],
  });
  mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
  vi.mocked(discoverSourceUrl).mockRejectedValue(new ListingFetchError("upstream 502", 502));

  const res = mockRes();
  await handler(mockReq() as any, res as any);

  expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "jobA" },
    data:  expect.objectContaining({
      state:    "PENDING",
      attempts: 1,    // unchanged
      lastError: expect.stringContaining("upstream 502"),
    }),
  }));
});

it("increments attempts on a genuine miss (listing parsed OK, no row matched)", async () => {
  const job  = { id: "jobA", state: "PENDING", attempts: 1, failureSentAt: null };
  const game = makeGame({
    scheduledFor: new Date(NOW.getTime() - 2 * HOUR),
    importJobs:   [job],
  });
  mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
  vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "no row for that date" });

  const res = mockRes();
  await handler(mockReq() as any, res as any);

  expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(expect.objectContaining({
    where: { id: "jobA" },
    data:  expect.objectContaining({ state: "PENDING", attempts: 2 }),
  }));
});
```

- [ ] **Step 2: Run; expect the transient-error test to FAIL (current code increments)**

Run: `npx vitest run tests/unit/server/api/discover-and-import.test.ts -t "transient ListingFetchError"`
Expected: FAIL — attempts came in as 2 instead of 1.

- [ ] **Step 3: Update `recordDiscoveryMiss` to accept a `transient` flag**

In `pages/api/cron/discover-and-import.ts`, replace the function with:

```ts
async function recordDiscoveryMiss(
  game:        Candidate,
  job:         Candidate["importJobs"][number] | null,
  reason:      string,
  newAttempts: number,
  summary:     RunSummary,
  transient:   boolean,
): Promise<void> {
  // Transient upstream failure: keep attempts unchanged so a Cloudflare blip
  // doesn't burn the 4-hour discovery window. Only genuine misses (parsed listing,
  // no row) count toward MAX_DISCOVERY_TRIES.
  const attempts    = transient ? (job?.attempts ?? 0) : newAttempts;
  const isAbandoned = !transient && newAttempts >= MAX_DISCOVERY_TRIES;
  const data = {
    state:         isAbandoned ? "ABANDONED" as const : "PENDING" as const,
    attempts,
    lastError:     `discovery: ${reason}`,
    lastAttemptAt: new Date(),
    lockedAt:      null,
    lockedBy:      null,
  };

  const updatedJob = job
    ? await prisma.gameImportJob.update({ where: { id: job.id }, data })
    : await prisma.gameImportJob.create({
        data: { upcomingGameId: game.id, sourceUrl: null, ...data },
      });

  auditLog("discover_source_url_miss", {
    upcomingGameId: game.id,
    opponent:       game.opponent,
    attempts,
    reason,
    transient,
    abandoned:      isAbandoned,
  });

  if (isAbandoned) {
    summary.abandoned++;
    if (!updatedJob.failureSentAt) {
      await sendImportNotification({
        kind:         "abandoned",
        opponent:     game.opponent,
        location:     game.location,
        scheduledFor: game.scheduledFor.toISOString(),
        attempts,
        lastError:    `discovery: ${reason}`,
      }).catch(err => console.error("[discover-and-import notify abandoned]", err));
      await prisma.gameImportJob.update({
        where: { id: updatedJob.id },
        data:  { failureSentAt: new Date() },
      });
    }
  }
}
```

- [ ] **Step 4: Run all discovery-outcomes tests**

Run: `npx vitest run tests/unit/server/api/discover-and-import.test.ts -t "discovery outcomes"`
Expected: PASS for all (including 2 new).

- [ ] **Step 5: Commit**

```bash
git add pages/api/cron/discover-and-import.ts tests/unit/server/api/discover-and-import.test.ts
git commit -m "fix(cron): don't increment attempts on transient listing failures"
```

---

### Task 5: Thread match reason into failure/abandoned email body

**Files:**
- Modify: `src/server/integrations/email/templates/admin-notifications.ts` (or wherever `buildImportFailure` / `buildImportAbandoned` live — locate via `grep -rn buildImportAbandoned src/server/integrations/email/`)
- Modify: `src/server/integrations/email/client.ts` (extend `ImportNotificationPayload`)
- Modify: `pages/api/cron/discover-and-import.ts` (pass reason)

- [ ] **Step 1: Locate the existing template**

Run: `grep -rn "buildImportAbandoned\|buildImportFailure" src/server/integrations/email/`
Expected: a single template file containing both functions.

- [ ] **Step 2: Read the template file and extend the abandoned/failure builders to render an optional `matchReason` line**

Add a `matchReason?: string | null` field to both `buildImportAbandoned` and `buildImportFailure` payload types. In the HTML/text bodies, render it under the `lastError` line:

```ts
// In the abandoned/failure HTML builder:
${payload.matchReason
  ? `<p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">Last match attempt: ${esc(payload.matchReason)}</p>`
  : ""}
// In the text builder:
${payload.matchReason ? `\nLast match attempt: ${payload.matchReason}` : ""}
```

- [ ] **Step 3: Extend `ImportNotificationPayload` in `src/server/integrations/email/client.ts:16-19`**

```ts
export type ImportNotificationPayload =
  | { kind: "success";   opponent: string; location: string; scheduledFor: string; importedAt: Date }
  | { kind: "failure";   opponent: string; location: string; scheduledFor: string; attempts: number; lastError: string | null; matchReason?: string | null }
  | { kind: "abandoned"; opponent: string; location: string; scheduledFor: string; attempts: number; lastError: string | null; matchReason?: string | null };
```

- [ ] **Step 4: Pass `matchReason` from the cron handler**

In `recordDiscoveryMiss` (modified in Task 4), update the `sendImportNotification` call:

```ts
await sendImportNotification({
  kind:         "abandoned",
  opponent:     game.opponent,
  location:     game.location,
  scheduledFor: game.scheduledFor.toISOString(),
  attempts,
  lastError:    `discovery: ${reason}`,
  matchReason:  reason,  // NEW
}).catch(err => console.error("[discover-and-import notify abandoned]", err));
```

In `src/server/services/import-job.ts`, update `notifyFailure` (lines 53-64):

```ts
async function notifyFailure(msg: string) {
  if (job.failureSentAt) return;
  await sendImportNotification({
    kind:         "failure",
    opponent:     job.upcomingGame.opponent,
    location:     job.upcomingGame.location,
    scheduledFor: job.upcomingGame.scheduledFor.toISOString(),
    attempts:     job.attempts,
    lastError:    msg,
    matchReason:  null,  // scrape failures have no opponent-match reason
  }).catch(err => console.error("[import-job notify failure]", err));
  await prisma.gameImportJob.update({ where: { id: jobId }, data: { failureSentAt: new Date() } });
}
```

- [ ] **Step 5: Run the full email-related test suite**

Run: `npx vitest run -t "email\\|notification\\|abandoned"`
Expected: PASS for everything that touches the email pipeline.

- [ ] **Step 6: Commit**

```bash
git add src/server/integrations/email/ pages/api/cron/discover-and-import.ts src/server/services/import-job.ts
git commit -m "feat(email): include match reason in abandoned/failure import emails"
```

---

## Phase 2 — Schema groundwork

### Task 6: Add `CronRun` model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_cron_run/migration.sql`

- [ ] **Step 1: Append the model to `prisma/schema.prisma`** (after `Setting`, before the `enum ImportJobState` block):

```prisma
model CronRun {
  id          String   @id @default(cuid())
  job         String   // e.g. "discover-and-import" or "import-heartbeat"
  startedAt   DateTime @default(now())
  finishedAt  DateTime?
  ok          Boolean  @default(false)
  summary     Json?
  error       String?

  @@index([job, startedAt])
}
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name add_cron_run`
Expected: a new directory under `prisma/migrations/<timestamp>_add_cron_run/` containing `migration.sql` with `CREATE TABLE "CronRun" (...)`.

- [ ] **Step 3: Verify Prisma client regeneration**

Run: `npx prisma generate`
Expected: `lib/generated/prisma/models/CronRun.ts` exists.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add CronRun model for cron-run history"
```

---

### Task 7: Add `OpponentAlias` model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_opponent_alias/migration.sql`

- [ ] **Step 1: Append the model to `prisma/schema.prisma`**:

```prisma
model OpponentAlias {
  id          String   @id @default(cuid())
  myName      String   @unique
  listingName String
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name add_opponent_alias`
Expected: new migration directory.

- [ ] **Step 3: Regenerate client**

Run: `npx prisma generate`
Expected: `lib/generated/prisma/models/OpponentAlias.ts` exists.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add OpponentAlias model for matcher dictionary"
```

---

### Task 8: Rename `UpcomingGame.importJobs` → `importJob` (singular optional)

Background: the schema enforces 1:1 (`upcomingGameId @unique`) but the relation name is plural and the cron does `importJobs[0]`. Renaming makes the type system enforce singular access.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `pages/api/cron/discover-and-import.ts` (line 57: `include: { importJobs: true }`, line 86: type alias, line 94: `game.importJobs[0]`)
- Modify: `pages/api/admin/schedule.ts` (no usages — verify)
- Modify: `src/server/services/import-game.ts` (line 200-206: `tx.gameImportJob.updateMany` is by `upcomingGameId`, not via the relation — likely unaffected; verify)
- Modify: `tests/unit/server/api/discover-and-import.test.ts` (`makeGame` factory uses `importJobs`)

- [ ] **Step 1: Update `prisma/schema.prisma:196`**

Replace:
```prisma
  importJobs     GameImportJob[]
```
with:
```prisma
  importJob      GameImportJob?
```

- [ ] **Step 2: Update the back-relation on `GameImportJob` (line 265 area) — should already be a single relation, just confirm it stays `upcomingGame UpcomingGame @relation(...)`**

No change needed if the back-relation is already singular.

- [ ] **Step 3: Generate migration**

Run: `npx prisma migrate dev --name rename_upcoming_game_import_relation`
Expected: an empty SQL migration (Prisma rename — no DDL changes since the unique index exists already). If Prisma asks to rename or drop/recreate, accept the rename.

- [ ] **Step 4: Update `pages/api/cron/discover-and-import.ts`**

Replace `include: { importJobs: true }` (line 57) with `include: { importJob: true }`.

Replace the `Candidate` type alias (lines 85-87) with:
```ts
type Candidate = Awaited<ReturnType<typeof prisma.upcomingGame.findMany>>[number] & {
  importJob: Awaited<ReturnType<typeof prisma.gameImportJob.findUnique>> | null;
};
```

Replace `const job = game.importJobs[0] ?? null;` (line 94) with `const job = game.importJob ?? null;`

Replace the recordDiscoveryMiss `job` parameter type:
```ts
job: Candidate["importJob"] | null,
```

- [ ] **Step 5: Update test factory in `tests/unit/server/api/discover-and-import.test.ts`**

Replace the `importJobs` field in `makeGame` (lines 67, 76):
```ts
function makeGame(overrides: Partial<{
  // ... other fields ...
  importJob:    any | null;
}> = {}) {
  return {
    // ... other fields ...
    importJob: overrides.importJob ?? null,
  };
}
```

Replace every `importJobs: [job]` in the test file with `importJob: job` and every `importJobs: []` with `importJob: null`.

- [ ] **Step 6: Run discover-and-import tests**

Run: `npx vitest run tests/unit/server/api/discover-and-import.test.ts`
Expected: PASS for all.

- [ ] **Step 7: Run full test suite to catch any other consumers**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ pages/api/cron/discover-and-import.ts tests/unit/server/api/discover-and-import.test.ts
git commit -m "refactor(db): rename UpcomingGame.importJobs to importJob (singular)"
```

---

## Phase 3 — Heartbeat (depends on Task 6)

### Task 9: `cron-run` helper + integrate into discover-and-import

**Files:**
- Create: `src/server/services/cron-run.ts`
- Create: `tests/unit/server/services/cron-run.test.ts`
- Modify: `pages/api/cron/discover-and-import.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/services/cron-run.test.ts`:

```ts
// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    cronRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));

import { startCronRun, finishCronRun } from "@/server/services/cron-run";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.cronRun.create.mockResolvedValue({ id: "run1", job: "discover-and-import", startedAt: new Date() });
  mockPrisma.cronRun.update.mockResolvedValue({});
});

describe("startCronRun", () => {
  it("creates a CronRun row and returns its id", async () => {
    const id = await startCronRun("discover-and-import");
    expect(id).toBe("run1");
    expect(mockPrisma.cronRun.create).toHaveBeenCalledWith({
      data: { job: "discover-and-import" },
    });
  });
});

describe("finishCronRun", () => {
  it("updates the row with ok=true, summary and finishedAt", async () => {
    await finishCronRun("run1", { ok: true, summary: { candidates: 3 } });
    expect(mockPrisma.cronRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run1" },
      data:  expect.objectContaining({
        ok: true,
        summary: { candidates: 3 },
        finishedAt: expect.any(Date),
        error: null,
      }),
    }));
  });

  it("updates the row with ok=false and an error message", async () => {
    await finishCronRun("run1", { ok: false, error: "boom" });
    expect(mockPrisma.cronRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run1" },
      data:  expect.objectContaining({ ok: false, error: "boom" }),
    }));
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `npx vitest run tests/unit/server/services/cron-run.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `src/server/services/cron-run.ts`**

```ts
import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

export async function startCronRun(job: string): Promise<string> {
  const row = await prisma.cronRun.create({ data: { job } });
  return row.id;
}

export interface FinishOptions {
  ok:       boolean;
  summary?: Record<string, unknown>;
  error?:   string | null;
}

export async function finishCronRun(id: string, opts: FinishOptions): Promise<void> {
  await prisma.cronRun.update({
    where: { id },
    data: {
      ok:         opts.ok,
      summary:    opts.summary ?? undefined,
      error:      opts.error ?? null,
      finishedAt: new Date(),
    },
  });
}
```

- [ ] **Step 4: Run cron-run tests**

Run: `npx vitest run tests/unit/server/services/cron-run.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into `pages/api/cron/discover-and-import.ts`**

At the top of the handler (after auth, before the candidate query), add:

```ts
import { startCronRun, finishCronRun } from "@/server/services/cron-run";

// inside handler, after the auth block:
const runId = await startCronRun("discover-and-import");

try {
  // ... existing candidate-loop code ...
  auditLog("cron_discover_and_import", { ...summary });
  await finishCronRun(runId, { ok: true, summary });
  return res.status(200).json({ ok: true, ...summary });
} catch (err) {
  console.error("[discover-and-import]", err);
  await finishCronRun(runId, { ok: false, error: (err as Error).message }).catch(() => {});
  return res.status(500).json({ error: "Internal server error" });
}
```

- [ ] **Step 6: Add a test asserting the handler writes a CronRun row**

Append in `tests/unit/server/api/discover-and-import.test.ts`:

```ts
// At the top, mock cron-run:
vi.mock("@/server/services/cron-run", () => ({
  startCronRun:  vi.fn().mockResolvedValue("run-test"),
  finishCronRun: vi.fn().mockResolvedValue(undefined),
}));

// inside an existing describe block, e.g. "auth":
it("records a CronRun row on successful run", async () => {
  const { startCronRun, finishCronRun } = await import("@/server/services/cron-run");
  const res = mockRes();
  await handler(mockReq() as any, res as any);
  expect(vi.mocked(startCronRun)).toHaveBeenCalledWith("discover-and-import");
  expect(vi.mocked(finishCronRun)).toHaveBeenCalledWith(
    "run-test",
    expect.objectContaining({ ok: true, summary: expect.any(Object) })
  );
});
```

- [ ] **Step 7: Run all discover-and-import tests**

Run: `npx vitest run tests/unit/server/api/discover-and-import.test.ts tests/unit/server/services/cron-run.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/server/services/cron-run.ts pages/api/cron/discover-and-import.ts tests/unit/server/services/cron-run.test.ts tests/unit/server/api/discover-and-import.test.ts
git commit -m "feat(cron): record discover-and-import runs in CronRun table"
```

---

### Task 10: Heartbeat email template

**Files:**
- Create: `src/server/integrations/email/templates/import-heartbeat.ts`
- Modify: `src/server/integrations/email/templates/index.ts`

- [ ] **Step 1: Create the template**

`src/server/integrations/email/templates/import-heartbeat.ts`:

```ts
import { esc } from "./shared";

export interface HeartbeatRun {
  startedAt: Date;
  ok:        boolean;
  summary:   Record<string, unknown> | null;
  error:     string | null;
}

export interface HeartbeatGame {
  id:           string;
  opponent:     string;
  scheduledFor: Date;
  hasListing:   boolean;
  jobState:     string | null;
  attempts:     number;
  lastError:    string | null;
}

export interface HeartbeatPayload {
  windowStart:    Date;
  windowEnd:      Date;
  runs:           HeartbeatRun[];
  inWindow:       HeartbeatGame[];     // games in the active 7-day backfill window
  dropouts:       HeartbeatGame[];     // games that fell out of the window without a terminal state
  upcomingNext7d: HeartbeatGame[];     // future games, flag-missing-listingUrl
}

export function buildImportHeartbeat(p: HeartbeatPayload): { subject: string; html: string; text: string } {
  const ok      = p.runs.filter(r => r.ok).length;
  const failed  = p.runs.length - ok;
  const subject = `Auto-import heartbeat — ${ok}/${p.runs.length} OK${p.dropouts.length > 0 ? ` · ${p.dropouts.length} DROPOUT(s)` : ""}`;

  const fmtDate = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

  const sectionGames = (title: string, games: HeartbeatGame[], emptyMsg: string, emphasize = false): { html: string; text: string } => {
    const colour = emphasize ? "#c92a2a" : "#374151";
    if (games.length === 0) {
      return {
        html: `<h3 style="margin:24px 0 8px;font-size:14px;color:${colour};">${esc(title)}</h3><p style="margin:0;color:#9ca3af;font-size:12px;">${esc(emptyMsg)}</p>`,
        text: `\n${title}\n  ${emptyMsg}\n`,
      };
    }
    const rowsHtml = games.map(g => `
      <tr>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${esc(g.opponent)}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${fmtDate(g.scheduledFor)}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${g.hasListing ? "✓" : "<strong style=\"color:#c92a2a\">missing</strong>"}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${esc(g.jobState ?? "—")}${g.attempts > 0 ? ` ×${g.attempts}` : ""}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:11px;color:#6b7280;">${esc(g.lastError ?? "")}</td>
      </tr>`).join("");
    const rowsText = games.map(g =>
      `  ${fmtDate(g.scheduledFor)} · ${g.opponent} · listing=${g.hasListing ? "yes" : "MISSING"} · job=${g.jobState ?? "—"}${g.attempts > 0 ? ` ×${g.attempts}` : ""}${g.lastError ? `\n    err: ${g.lastError}` : ""}`
    ).join("\n");
    return {
      html: `<h3 style="margin:24px 0 8px;font-size:14px;color:${colour};">${esc(title)} (${games.length})</h3>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
          <tr>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Opponent</th>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Scheduled</th>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Listing</th>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Job</th>
            <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Last error</th>
          </tr>
          ${rowsHtml}
        </table>`,
      text: `\n${title} (${games.length})\n${rowsText}\n`,
    };
  };

  const inWin    = sectionGames("Active window (last 7 days)", p.inWindow, "no candidates");
  const drops    = sectionGames("DROPOUTS — fell out of window without import or abandon", p.dropouts, "none — clean", true);
  const next7d   = sectionGames("Next 7 days schedule", p.upcomingNext7d, "no upcoming games");

  const runsHtml = p.runs.length === 0
    ? `<p style="margin:0;color:#9ca3af;font-size:12px;">no runs in the last 24 h</p>`
    : `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
        <tr>
          <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;">When</th>
          <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;">Status</th>
          <th align="left" style="padding:6px 8px;font-size:11px;color:#6b7280;">Summary / Error</th>
        </tr>
        ${p.runs.map(r => `<tr>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;">${fmtDate(r.startedAt)}</td>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:12px;color:${r.ok ? "#15803d" : "#c92a2a"};font-weight:700;">${r.ok ? "OK" : "FAIL"}</td>
          <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:11px;color:#374151;">${esc(r.error ?? JSON.stringify(r.summary ?? {}))}</td>
        </tr>`).join("")}
      </table>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">ARMANI KATEHANO</p>
      <h1 style="margin:8px 0 4px;font-size:20px;font-weight:900;">Auto-import heartbeat</h1>
      <p style="margin:0;font-size:12px;color:#6b7280;">Last 24 h: ${ok} OK, ${failed} failed</p>

      <h3 style="margin:24px 0 8px;font-size:14px;">Runs</h3>
      ${runsHtml}

      ${inWin.html}
      ${drops.html}
      ${next7d.html}

      <p style="margin:32px 0 0;font-size:11px;color:#9ca3af;">Generated at ${fmtDate(new Date())}</p>
    </div>
  </body></html>`;

  const text = `ARMANI KATEHANO\nAuto-import heartbeat\n\nLast 24 h: ${ok} OK, ${failed} failed\n\nRuns\n${
    p.runs.length === 0
      ? "  no runs in the last 24 h"
      : p.runs.map(r => `  ${fmtDate(r.startedAt)} · ${r.ok ? "OK" : "FAIL"} · ${r.error ?? JSON.stringify(r.summary ?? {})}`).join("\n")
  }\n${inWin.text}${drops.text}${next7d.text}\nGenerated at ${fmtDate(new Date())}`;

  return { subject, html, text };
}
```

- [ ] **Step 2: Confirm `esc` is exported from a shared file in the templates dir**

Run: `grep -rn "export.*esc" src/server/integrations/email/templates/`
Expected: a single `export function esc` (or `export { esc }`). If `esc` lives in `shared.ts`, the import path above is correct. If it lives in `index.ts`, change the import to `from "./index"`.

- [ ] **Step 3: Re-export from index**

Append to `src/server/integrations/email/templates/index.ts`:

```ts
export { buildImportHeartbeat } from "./import-heartbeat";
export type { HeartbeatPayload, HeartbeatRun, HeartbeatGame } from "./import-heartbeat";
```

- [ ] **Step 4: Quick smoke build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
git add src/server/integrations/email/templates/
git commit -m "feat(email): heartbeat email template (runs, dropouts, next-7-days)"
```

---

### Task 11: `sendImportHeartbeat` in email client

**Files:**
- Modify: `src/server/integrations/email/client.ts`

- [ ] **Step 1: Add export at the bottom of `src/server/integrations/email/client.ts`** (after `sendImportNotification`):

```ts
import { buildImportHeartbeat, type HeartbeatPayload } from "./templates";

export async function sendImportHeartbeat(payload: HeartbeatPayload): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set — skipping heartbeat");
    return;
  }
  const to = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";
  const { subject, html, text } = buildImportHeartbeat(payload);
  try {
    await transport.sendMail({ from: FROM, to, subject, html, text });
    auditLog("import_heartbeat_sent", { runs: payload.runs.length, dropouts: payload.dropouts.length });
  } catch (err: any) {
    auditLog("import_heartbeat_failed", { error: err.message });
  }
}
```

(The `import` line should be merged with the existing `import { ... } from "./templates";` block at the top of the file rather than a second import.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/server/integrations/email/client.ts
git commit -m "feat(email): sendImportHeartbeat"
```

---

### Task 12: `/api/cron/import-heartbeat` handler

**Files:**
- Create: `pages/api/cron/import-heartbeat.ts`
- Create: `tests/unit/server/api/import-heartbeat.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/api/import-heartbeat.test.ts`:

```ts
// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    cronRun:      { findMany: vi.fn() },
    upcomingGame: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/integrations/email/client", () => ({
  sendImportHeartbeat: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/security/edge", () => ({ securityHeaders: () => ({ "X-Test": "1" }) }));
vi.mock("@/server/security/node",  () => ({ auditLog: vi.fn() }));

import handler from "../../../../pages/api/cron/import-heartbeat";
import { sendImportHeartbeat } from "@/server/integrations/email/client";

const NOW = new Date("2026-05-01T05:05:00Z");

function mockReq(o: any = {}) {
  return { method: o.method ?? "GET", headers: o.headers ?? { authorization: "Bearer test-secret" } };
}
function mockRes() {
  return {
    statusCode: 0, body: null,
    setHeader: vi.fn(),
    status(c: number) { this.statusCode = c; return this; },
    json(b: any)      { this.body = b;       return this; },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = "test-secret";
  mockPrisma.cronRun.findMany.mockResolvedValue([]);
  mockPrisma.upcomingGame.findMany.mockResolvedValue([]);
});

describe("import-heartbeat auth", () => {
  it("returns 401 without bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
  });
});

describe("import-heartbeat content", () => {
  it("sends an email with runs, in-window, dropouts and next-7-days sections", async () => {
    mockPrisma.cronRun.findMany.mockResolvedValue([
      { id: "r1", job: "discover-and-import", startedAt: new Date(NOW.getTime() - 3600_000), ok: true, summary: { candidates: 1, imported: 1 }, error: null, finishedAt: new Date() },
    ]);
    mockPrisma.upcomingGame.findMany
      .mockResolvedValueOnce([
        // in-window game (scheduledFor 3 days ago, no IMPORTED job)
        {
          id: "g1", opponent: "Παναθηναϊκός",
          scheduledFor: new Date(NOW.getTime() - 3 * 24 * 3600_000),
          listingUrl: "x", importJob: { state: "PENDING", attempts: 1, lastError: "no row yet" },
        },
      ])
      .mockResolvedValueOnce([
        // dropout (10 days ago, still PENDING)
        {
          id: "g2", opponent: "AEK",
          scheduledFor: new Date(NOW.getTime() - 10 * 24 * 3600_000),
          listingUrl: null, importJob: null,
        },
      ])
      .mockResolvedValueOnce([
        // upcoming (3 days ahead, missing listing)
        {
          id: "g3", opponent: "ΟΣΦΠ",
          scheduledFor: new Date(NOW.getTime() + 3 * 24 * 3600_000),
          listingUrl: null, importJob: null,
        },
      ]);

    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(sendImportHeartbeat).toHaveBeenCalledWith(expect.objectContaining({
      runs:           expect.arrayContaining([expect.objectContaining({ ok: true })]),
      inWindow:       expect.arrayContaining([expect.objectContaining({ opponent: "Παναθηναϊκός" })]),
      dropouts:       expect.arrayContaining([expect.objectContaining({ opponent: "AEK" })]),
      upcomingNext7d: expect.arrayContaining([expect.objectContaining({ opponent: "ΟΣΦΠ", hasListing: false })]),
    }));
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `npx vitest run tests/unit/server/api/import-heartbeat.test.ts`
Expected: FAIL — handler does not exist.

- [ ] **Step 3: Implement `pages/api/cron/import-heartbeat.ts`**

```ts
/**
 * Daily heartbeat at 05:05 UTC. Summarizes the last 24 h of discover-and-import
 * cron runs, plus three game lists: active 7-day window, dropouts (older than
 * 7 d without a terminal state), and the next 7 days of scheduled games.
 */

import { timingSafeEqual } from "node:crypto";
import prisma                   from "@/server/db/client";
import { sendImportHeartbeat }  from "@/server/integrations/email/client";
import { securityHeaders }      from "@/server/security/edge";
import { auditLog }             from "@/server/security/node";

const DAY_MS  = 24 * 60 * 60 * 1000;

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const secret = process.env.CRON_SECRET;
  const auth   = String(req.headers["authorization"] ?? "");
  const expect = `Bearer ${secret ?? ""}`;
  if (!secret || auth.length !== expect.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expect))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now            = new Date();
  const last24h        = new Date(now.getTime() - DAY_MS);
  const sevenDaysAgo   = new Date(now.getTime() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
  const sevenDaysAhead = new Date(now.getTime() + 7 * DAY_MS);

  try {
    const runs = await prisma.cronRun.findMany({
      where: { job: "discover-and-import", startedAt: { gte: last24h } },
      orderBy: { startedAt: "desc" },
    });

    const inWindow = await prisma.upcomingGame.findMany({
      where: {
        scheduledFor: { gte: sevenDaysAgo, lte: now },
        importJob:    { is: { state: { not: "IMPORTED" } } },
      },
      include: { importJob: true },
      orderBy: { scheduledFor: "asc" },
    });

    const dropouts = await prisma.upcomingGame.findMany({
      where: {
        scheduledFor: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        OR: [
          { importJob: null },
          { importJob: { is: { state: { notIn: ["IMPORTED", "ABANDONED"] } } } },
        ],
      },
      include: { importJob: true },
      orderBy: { scheduledFor: "asc" },
    });

    const upcomingNext7d = await prisma.upcomingGame.findMany({
      where:   { scheduledFor: { gte: now, lte: sevenDaysAhead } },
      include: { importJob: true },
      orderBy: { scheduledFor: "asc" },
    });

    const toGame = (g: any) => ({
      id:           g.id,
      opponent:     g.opponent,
      scheduledFor: g.scheduledFor,
      hasListing:   !!g.listingUrl,
      jobState:     g.importJob?.state    ?? null,
      attempts:     g.importJob?.attempts ?? 0,
      lastError:    g.importJob?.lastError ?? null,
    });

    await sendImportHeartbeat({
      windowStart:    sevenDaysAgo,
      windowEnd:      now,
      runs:           runs.map(r => ({
        startedAt: r.startedAt,
        ok:        r.ok,
        summary:   (r.summary ?? null) as Record<string, unknown> | null,
        error:     r.error,
      })),
      inWindow:       inWindow.map(toGame),
      dropouts:       dropouts.map(toGame),
      upcomingNext7d: upcomingNext7d.map(toGame),
    });

    auditLog("cron_import_heartbeat", {
      runs:     runs.length,
      inWindow: inWindow.length,
      dropouts: dropouts.length,
      upcoming: upcomingNext7d.length,
    });

    return res.status(200).json({
      ok: true,
      runs: runs.length,
      inWindow: inWindow.length,
      dropouts: dropouts.length,
      upcoming: upcomingNext7d.length,
    });
  } catch (err) {
    console.error("[import-heartbeat]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

- [ ] **Step 4: Run heartbeat tests**

Run: `npx vitest run tests/unit/server/api/import-heartbeat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pages/api/cron/import-heartbeat.ts tests/unit/server/api/import-heartbeat.test.ts
git commit -m "feat(cron): daily import heartbeat email"
```

---

### Task 13: Wire heartbeat into `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Edit `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/purge-subscribers", "schedule": "0 3 * * *" },
    { "path": "/api/cron/purge-error-html",  "schedule": "0 4 * * *" },
    { "path": "/api/cron/import-heartbeat",  "schedule": "5 5 * * *" }
  ],
  "functions": {
    "pages/api/cron/discover-and-import.ts": { "maxDuration": 60 },
    "pages/api/cron/import-heartbeat.ts":    { "maxDuration": 30 }
  }
}
```

- [ ] **Step 2: Verify JSON parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore(cron): schedule import heartbeat at 05:05 UTC daily"
```

---

## Phase 4 — Opponent aliases (depends on Task 7)

### Task 14: Zod schema for OpponentAlias

**Files:**
- Create: `src/schemas/opponent-alias.ts`

- [ ] **Step 1: Create the schema file**

```ts
import { z } from "zod";

export const OpponentAliasWriteSchema = z.object({
  myName:      z.string().min(1).max(100),
  listingName: z.string().min(1).max(100),
  notes:       z.string().max(500).optional().nullable(),
});

export const OpponentAliasUpdateSchema = OpponentAliasWriteSchema.extend({
  id: z.string().cuid(),
});

export const OpponentAliasDeleteSchema = z.object({
  id: z.string().cuid(),
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/schemas/opponent-alias.ts
git commit -m "feat(schema): zod validation for OpponentAlias"
```

---

### Task 15: REST CRUD `/api/admin/opponent-aliases`

**Files:**
- Create: `pages/api/admin/opponent-aliases/[[...params]].ts`
- Create: `tests/unit/server/api/opponent-aliases.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/server/api/opponent-aliases.test.ts`:

```ts
// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    opponentAlias: {
      findMany: vi.fn(),
      create:   vi.fn(),
      update:   vi.fn(),
      delete:   vi.fn(),
    },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/auth", () => ({
  requireAuth: (h: any) => h,
  validateAdminSlug: () => true,
}));
vi.mock("@/server/security/node", () => ({
  auditLog:    vi.fn(),
  getClientIp: () => "1.1.1.1",
}));

import handler from "../../../../pages/api/admin/opponent-aliases/[[...params]]";

function mockReq(o: any = {}) {
  return {
    method:  o.method ?? "GET",
    headers: { authorization: "Bearer admin" },
    body:    o.body,
    query:   o.query ?? {},
  };
}
function mockRes() {
  return {
    statusCode: 0, body: null,
    setHeader: vi.fn(),
    status(c: number) { this.statusCode = c; return this; },
    json(b: any)      { this.body = b;       return this; },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.opponentAlias.findMany.mockResolvedValue([]);
});

describe("GET /api/admin/opponent-aliases", () => {
  it("lists aliases ordered by myName", async () => {
    mockPrisma.opponentAlias.findMany.mockResolvedValue([
      { id: "a1", myName: "Παναθηναϊκός", listingName: "ΠΑΟ", notes: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = mockRes();
    await handler(mockReq({ method: "GET", query: { params: [] } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ aliases: [{ myName: "Παναθηναϊκός", listingName: "ΠΑΟ" }] });
  });
});

describe("POST /api/admin/opponent-aliases", () => {
  it("creates an alias", async () => {
    mockPrisma.opponentAlias.create.mockResolvedValue({ id: "a1" });
    const res = mockRes();
    await handler(mockReq({
      method: "POST",
      query:  { params: [] },
      body:   { myName: "Παναθηναϊκός", listingName: "ΠΑΟ" },
    }), res);
    expect(res.statusCode).toBe(201);
    expect(mockPrisma.opponentAlias.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ myName: "Παναθηναϊκός", listingName: "ΠΑΟ" }),
    });
  });

  it("rejects empty myName", async () => {
    const res = mockRes();
    await handler(mockReq({
      method: "POST",
      query:  { params: [] },
      body:   { myName: "", listingName: "ΠΑΟ" },
    }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("PUT /api/admin/opponent-aliases", () => {
  it("updates an alias", async () => {
    mockPrisma.opponentAlias.update.mockResolvedValue({});
    const res = mockRes();
    await handler(mockReq({
      method: "PUT",
      query:  { params: [] },
      body:   { id: "ckabcdefghijklmnopqrstuv", myName: "X", listingName: "Y" },
    }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe("DELETE /api/admin/opponent-aliases", () => {
  it("deletes an alias", async () => {
    mockPrisma.opponentAlias.delete.mockResolvedValue({});
    const res = mockRes();
    await handler(mockReq({
      method: "DELETE",
      query:  { params: [] },
      body:   { id: "ckabcdefghijklmnopqrstuv" },
    }), res);
    expect(res.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `npx vitest run tests/unit/server/api/opponent-aliases.test.ts`
Expected: FAIL — handler missing.

- [ ] **Step 3: Implement the handler**

Create `pages/api/admin/opponent-aliases/[[...params]].ts`:

```ts
import { requireAuth }              from "@/server/auth";
import { auditLog, getClientIp }    from "@/server/security/node";
import prisma                       from "@/server/db/client";
import {
  OpponentAliasWriteSchema,
  OpponentAliasUpdateSchema,
  OpponentAliasDeleteSchema,
} from "@/schemas/opponent-alias";
import { handleError }  from "@/server/http/handle-error";
import { parseBody }    from "@/server/http/parse-body";

async function listAliases(_req: any, res: any) {
  const aliases = await prisma.opponentAlias.findMany({ orderBy: { myName: "asc" } });
  return res.status(200).json({
    aliases: aliases.map(a => ({
      id:          a.id,
      myName:      a.myName,
      listingName: a.listingName,
      notes:       a.notes ?? null,
      createdAt:   a.createdAt.toISOString(),
      updatedAt:   a.updatedAt.toISOString(),
    })),
  });
}

async function createAlias(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(OpponentAliasWriteSchema, req.body, res);
  if (!data) return;
  try {
    const row = await prisma.opponentAlias.create({
      data: { myName: data.myName, listingName: data.listingName, notes: data.notes ?? null },
    });
    auditLog("opponent_alias_created", { ip, id: row.id, myName: data.myName });
    return res.status(201).json({ ok: true, id: row.id });
  } catch (err) {
    auditLog("opponent_alias_create_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

async function updateAlias(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(OpponentAliasUpdateSchema, req.body, res);
  if (!data) return;
  try {
    await prisma.opponentAlias.update({
      where: { id: data.id },
      data:  { myName: data.myName, listingName: data.listingName, notes: data.notes ?? null },
    });
    auditLog("opponent_alias_updated", { ip, id: data.id });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

async function deleteAlias(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(OpponentAliasDeleteSchema, req.body, res);
  if (!data) return;
  try {
    await prisma.opponentAlias.delete({ where: { id: data.id } });
    auditLog("opponent_alias_deleted", { ip, id: data.id });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method === "GET")    return listAliases(req, res);
  if (req.method === "POST")   return createAlias(req, res);
  if (req.method === "PUT")    return updateAlias(req, res);
  if (req.method === "DELETE") return deleteAlias(req, res);
  return res.status(405).json({ error: "Method not allowed" });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/server/api/opponent-aliases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pages/api/admin/opponent-aliases/ src/schemas/opponent-alias.ts tests/unit/server/api/opponent-aliases.test.ts
git commit -m "feat(api): admin CRUD for OpponentAlias"
```

---

### Task 16: Wire alias lookup into `discoverSourceUrl`

**Files:**
- Modify: `src/server/services/discover-source-url.ts`
- Modify: `tests/unit/server/services/discover-source-url.test.ts`

Match strategy: when an alias exists for `input.opponent`, evaluate Levenshtein against **both** the alias's `listingName` *and* the original opponent string, take the minimum across both candidates × all rows. Always at least as lenient as today.

- [ ] **Step 1: Add tests**

Append to `tests/unit/server/services/discover-source-url.test.ts`:

```ts
// At top of file, alongside existing mocks:
vi.mock("@/server/db/client", () => ({
  default: { opponentAlias: { findUnique: vi.fn() } },
}));

// in a new describe block at the bottom:
describe("opponent alias dictionary", () => {
  it("matches via the alias listingName when the original opponent doesn't", async () => {
    const { default: prisma } = await import("@/server/db/client");
    vi.mocked(prisma.opponentAlias.findUnique).mockResolvedValue({
      id: "a1", myName: "ΠΑΟ", listingName: "ΠΑΝΑΘΗΝΑΪΚΟΣ Α.Ο.",
      notes: null, createdAt: new Date(), updatedAt: new Date(),
    });

    fetchMock.mockResolvedValue(htmlOk(`<ul>${rowHtml({
      href:  "/men/gamedetails/id/PAO",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "ΠΑΝΑΘΗΝΑΪΚΟΣ Α.Ο.",
    })}</ul>`));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "ΠΑΟ",
    });

    expect(result.gameUrl).toBe("https://basketcity.sportstats.gr/men/gamedetails/id/PAO");
  });

  it("still matches via the original opponent when no alias exists", async () => {
    const { default: prisma } = await import("@/server/db/client");
    vi.mocked(prisma.opponentAlias.findUnique).mockResolvedValue(null);

    fetchMock.mockResolvedValue(htmlOk(`<ul>${rowHtml({
      href:  "/men/gamedetails/id/AAA",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "Παναθηναϊκός",
    })}</ul>`));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "Παναθηναϊκός",
    });

    expect(result.gameUrl).toBe("https://basketcity.sportstats.gr/men/gamedetails/id/AAA");
  });
});
```

- [ ] **Step 2: Run; expect first new test to FAIL**

Run: `npx vitest run tests/unit/server/services/discover-source-url.test.ts -t "opponent alias"`
Expected: FAIL — current matcher would not find "ΠΑΟ" in "ΠΑΝΑΘΗΝΑΪΚΟΣ Α.Ο." (Levenshtein dist way over threshold).

- [ ] **Step 3: Update `discoverSourceUrl`**

In `src/server/services/discover-source-url.ts`, modify `discoverSourceUrl`:

```ts
import prisma from "@/server/db/client";

// ... existing imports ...

export async function discoverSourceUrl(input: DiscoverInput): Promise<DiscoverResult> {
  const html = await fetchListing(input.listingUrl);
  const rows = parseListingHtml(html, input.listingUrl);

  if (rows.length === 0)
    return { gameUrl: null, reason: "listing parsed but contained no recognised games" };

  const targetDay = new Date(Date.UTC(
    input.scheduledFor.getUTCFullYear(),
    input.scheduledFor.getUTCMonth(),
    input.scheduledFor.getUTCDate(),
  )).getTime();

  const sameDay = rows.filter(r => r.playedOn.getTime() === targetDay);
  if (sameDay.length === 0)
    return { gameUrl: null, reason: `no listing row for ${new Date(targetDay).toISOString().slice(0, 10)}` };

  // Try the original opponent string AND any registered alias listingName.
  // The matcher takes the global minimum Levenshtein distance across both candidates.
  const alias = await prisma.opponentAlias.findUnique({ where: { myName: input.opponent } }).catch(() => null);
  const candidates: string[] = [input.opponent];
  if (alias?.listingName) candidates.push(alias.listingName);

  let best: typeof sameDay[number] | null = null;
  let bestDist = Infinity;
  let bestCandidate = "";

  for (const candidate of candidates) {
    const normTarget = normalize(candidate);
    for (const row of sameDay) {
      const normRow = normalize(row.opponent);
      const dist    = levenshtein(normTarget, normRow);
      const ratio   = dist / Math.max(normTarget.length, normRow.length, 1);
      if (ratio <= LEVENSHTEIN_MAX_RATIO && dist < bestDist) {
        bestDist      = dist;
        best          = row;
        bestCandidate = candidate;
      }
    }
  }

  if (!best)
    return { gameUrl: null, reason: `${sameDay.length} row(s) on that date but none matched opponent "${input.opponent}"${alias ? ` (alias "${alias.listingName}" also tried)` : ""}` };

  return {
    gameUrl: best.gameUrl,
    reason:  `matched listing row (opponent="${best.opponent}", via="${bestCandidate}", dist=${bestDist})`,
  };
}
```

- [ ] **Step 4: Run all alias tests**

Run: `npx vitest run tests/unit/server/services/discover-source-url.test.ts`
Expected: PASS for all (including new alias tests and the existing 12).

- [ ] **Step 5: Commit**

```bash
git add src/server/services/discover-source-url.ts tests/unit/server/services/discover-source-url.test.ts
git commit -m "feat(discover): consult OpponentAlias dictionary before fuzzy match"
```

---

### Task 17: Admin UI for opponent aliases

**Files:**
- Create: `pages/admin/[slug]/opponent-aliases.tsx`

- [ ] **Step 1: Read an existing admin page to copy the layout pattern**

Run: `cat pages/admin/[slug]/schedule.tsx | head -80`
Expected: see `AdminLayout`, `Spinner`, `LoginForm`, `useAdminAuth`, `apiFetch` imports — copy that pattern.

- [ ] **Step 2: Create `pages/admin/[slug]/opponent-aliases.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AdminLayout, Spinner, LoginForm, useAdminAuth, apiFetch } from "@/client/admin";
import { validateAdminSlug } from "@/server/auth";

interface Alias {
  id:          string;
  myName:      string;
  listingName: string;
  notes:       string | null;
}

export default function OpponentAliasesPage({ validSlug }: { validSlug: boolean }) {
  const router = useRouter();
  const slug = router.query.slug || validSlug;
  const { authed, loading: checking, loginError, handleLogin, handleLogout } = useAdminAuth(slug);

  const [aliases, setAliases]   = useState<Alias[]>([]);
  const [loading, setLoading]   = useState(false);
  const [editing, setEditing]   = useState<Partial<Alias> | null>(null);
  const [error,   setError]     = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const res  = await apiFetch("/api/admin/opponent-aliases");
      const json = await res.json();
      setAliases(json.aliases ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (authed) load(); }, [authed]);

  const save = async () => {
    if (!editing) return;
    setError("");
    const isUpdate = !!editing.id;
    const res = await apiFetch("/api/admin/opponent-aliases", {
      method:  isUpdate ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        ...(isUpdate ? { id: editing.id } : {}),
        myName:      editing.myName,
        listingName: editing.listingName,
        notes:       editing.notes ?? null,
      }),
    });
    const body = await res.json();
    if (!res.ok) { setError(body.error ?? "Save failed"); return; }
    setEditing(null);
    await load();
  };

  const remove = async (id: string) => {
    const res = await apiFetch("/api/admin/opponent-aliases", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ id }),
    });
    if (res.ok) await load();
  };

  if (checking) return <Spinner />;
  if (!authed)  return <LoginForm onLogin={handleLogin} error={loginError} />;

  return (
    <AdminLayout title="Opponent aliases" onLogout={handleLogout}>
      <p className="text-sm text-ak-text-dim mb-4">
        Map the way you type an opponent's name to the way the listing shows it.
        The auto-import matcher tries both, so you can keep entering names your way.
      </p>

      {error && <div className="text-ak-red text-sm mb-2">{error}</div>}

      {loading ? <Spinner /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-ak-text-dim text-[10px] uppercase tracking-[0.12em]">
              <th align="left" className="py-2">My name</th>
              <th align="left">Listing name</th>
              <th align="left">Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {aliases.map(a => (
              <tr key={a.id} className="border-t border-ak-border">
                <td className="py-2">{a.myName}</td>
                <td>{a.listingName}</td>
                <td className="text-ak-text-dim">{a.notes ?? ""}</td>
                <td className="text-right">
                  <button className="text-xs underline mr-2" onClick={() => setEditing(a)}>edit</button>
                  <button className="text-xs underline text-ak-red" onClick={() => remove(a.id)}>delete</button>
                </td>
              </tr>
            ))}
            {aliases.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-ak-text-dim">No aliases yet</td></tr>
            )}
          </tbody>
        </table>
      )}

      <button className="mt-4 text-sm underline" onClick={() => setEditing({ myName: "", listingName: "", notes: "" })}>
        + add alias
      </button>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-ak-surface border border-ak-border p-4 max-w-md w-full">
            <h3 className="text-sm font-bold mb-3">{editing.id ? "Edit alias" : "New alias"}</h3>
            <label className="block text-xs uppercase tracking-[0.12em] text-ak-text-dim mb-1">My name (the way I type it)</label>
            <input className="w-full bg-black border border-ak-border p-2 mb-3 text-sm"
                   value={editing.myName ?? ""}
                   onChange={e => setEditing({ ...editing, myName: e.target.value })} />
            <label className="block text-xs uppercase tracking-[0.12em] text-ak-text-dim mb-1">Listing name (as on sportstats)</label>
            <input className="w-full bg-black border border-ak-border p-2 mb-3 text-sm"
                   value={editing.listingName ?? ""}
                   onChange={e => setEditing({ ...editing, listingName: e.target.value })} />
            <label className="block text-xs uppercase tracking-[0.12em] text-ak-text-dim mb-1">Notes</label>
            <textarea className="w-full bg-black border border-ak-border p-2 mb-3 text-sm" rows={2}
                      value={editing.notes ?? ""}
                      onChange={e => setEditing({ ...editing, notes: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button className="text-xs underline" onClick={() => setEditing(null)}>cancel</button>
              <button className="text-xs underline text-ak-green" onClick={save}>save</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export async function getServerSideProps(ctx: any) {
  return { props: { validSlug: validateAdminSlug(ctx.params?.slug) } };
}
```

- [ ] **Step 3: Smoke-test in dev**

Run: `npm run dev` (in another terminal) and visit `http://localhost:3000/admin/<slug>/opponent-aliases`. Add an alias, edit it, delete it.
Expected: round-trip works; the row appears, edits persist, deletes vanish.

- [ ] **Step 4: Commit**

```bash
git add pages/admin/[slug]/opponent-aliases.tsx
git commit -m "feat(admin): UI for OpponentAlias dictionary"
```

---

## Phase 5 — Admin notes & cleanup

### Task 18: Admin notes + RESET on IMPORTED jobs

**Files:**
- Modify: `pages/admin/[slug]/schedule.tsx` (job-action UI section starting ~line 224)

- [ ] **Step 1: Update the job badge / action block in `pages/admin/[slug]/schedule.tsx:224-245`**

Replace the conditional rendering block with one that shows a small reset hint when state is IMPORTED, exposes a RESET button, and shows context tooltips on ABANDONED/ERROR:

```tsx
{(() => {
  const job = jobMap.get(g.id);
  if (!job) return null;
  const tooltip =
    job.state === "IMPORTED"  ? "If you deleted the imported game, click RESET to re-import." :
    job.state === "ABANDONED" ? "Discovery gave up after 4 attempts. RESET to try again."     :
    job.state === "ERROR"     ? "Last scrape attempt errored. RESET to try again."            :
    job.lastError ?? undefined;
  return (
    <div className="flex items-center gap-[6px] flex-wrap">
      <span className={`text-[10px] font-black tracking-[0.12em] ${JOB_BADGE[job.state] ?? "text-ak-text-dim"}`}
            title={tooltip}>
        {job.state}
        {job.attempts > 0 && <> ×{job.attempts}</>}
      </span>
      {job.state !== "IMPORTED" && (
        <Btn size="sm" variant="green" onClick={() => doJobAction(job.id, "run-now")}>RUN</Btn>
      )}
      {(job.state === "PENDING" || job.state === "ERROR") && (
        <Btn size="sm" variant="ghost" onClick={() => doJobAction(job.id, "abandon")}>ABANDON</Btn>
      )}
      {(job.state === "ERROR" || job.state === "ABANDONED" || job.state === "IMPORTED") && (
        <Btn size="sm" variant="ghost" onClick={() => doJobAction(job.id, "reset")}>RESET</Btn>
      )}
    </div>
  );
})()}
```

- [ ] **Step 2: Smoke-test in dev**

Run: `npm run dev` and visit `/admin/<slug>/schedule`.
Expected: hovering a job badge shows the appropriate tooltip; IMPORTED rows now show a RESET button.

- [ ] **Step 3: Commit**

```bash
git add pages/admin/[slug]/schedule.tsx
git commit -m "feat(admin): tooltips on import jobs + RESET visible on IMPORTED state"
```

---

### Task 19: Rename misplaced integration test

**Files:**
- Rename: `tests/integration/server/services/import-job.test.ts` → `tests/unit/server/services/import-job.test.ts`

Background: the file mocks `@/server/db/client`; it's a unit test, not an integration test.

- [ ] **Step 1: Move the file**

Run: `git mv tests/integration/server/services/import-job.test.ts tests/unit/server/services/import-job.test.ts`
Expected: file moved, no diff inside the file.

- [ ] **Step 2: Verify the test still runs**

Run: `npx vitest run tests/unit/server/services/import-job.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: move misnamed integration test to unit"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `npm test`
Expected: PASS for everything.

- [ ] **Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Spot-check by triggering the cron locally** (optional but recommended):

Run: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/import-heartbeat`
Expected: `{ "ok": true, ... }` and an email arrives at `ADMIN_ALERT_EMAIL`.

---

## Out-of-scope (not in this plan)

- L8: 4-hour discovery window stays as-is (per L5 answer).
- L6: UTC-vs-local-tz calendar comparison — not changing; works in single-tz operations.
- Any UI for the heartbeat (read-only email is sufficient per the spec).
- Sentry breadcrumb / error grouping — could layer on later; the CronRun row is the source of truth.

## Risks / known sharp edges

- **Prisma rename in Task 8** can be touchy. If `prisma migrate dev` proposes to drop+recreate the `GameImportJob` table instead of a no-op rename, abort the migration with Ctrl-C, edit the generated migration to be a no-op, and `--create-only` flag the next attempt.
- **Step 4 of Task 17 (dev smoke)** depends on `apiFetch`'s auth header injection working as elsewhere — copy paste from `schedule.tsx` if anything diverges.
- **Heartbeat email is sent unconditionally daily.** If you'd rather suppress it on a "nothing to report" day, add `if (runs.length === 0 && dropouts.length === 0 && upcomingNext7d.length === 0) return ok-without-sending;` in the heartbeat handler.
