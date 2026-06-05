/**
 * pages/api/cron/discover-and-import.ts
 *
 * Hourly heartbeat from GitHub Actions. For each UpcomingGame whose tip-off
 * was at least 1 h ago and that hasn't been imported, scan the admin-supplied
 * listingUrl to find the gamedetails URL, then run the existing processJob.
 *
 * Backoff per game: attempt 1 fires at scheduledFor+1h, attempt 2 at +2h,
 * then ABANDONED + admin email.
 */

import { timingSafeEqual } from "node:crypto";
import prisma from "@/server/db/client";
import { processJob } from "@/server/services/import-job";
import {
  discoverSourceUrl,
  ListingFetchError,
} from "@/server/services/discover-source-url";
import { sendImportNotification } from "@/server/integrations/email/client";
import { securityHeaders } from "@/server/security/edge";
import { auditLog } from "@/server/security/node";
import { startCronRun, finishCronRun } from "@/server/services/cron-run";

const WINDOW_DAYS = 7;
const MAX_DISCOVERY_TRIES = 4;
const HOUR_MS = 60 * 60 * 1000;

interface RunSummary {
  candidates: number;
  discovered: number;
  imported: number;
  abandoned: number;
  errors: number;
  skipped: number;
}

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = String(req.headers["authorization"] ?? "");
  const expected = `Bearer ${cronSecret ?? ""}`;
  if (
    !cronSecret ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const runId = await startCronRun("discover-and-import");

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * HOUR_MS);
  const windowEnd = new Date(now.getTime() - HOUR_MS);

  const summary: RunSummary = {
    candidates: 0,
    discovered: 0,
    imported: 0,
    abandoned: 0,
    errors: 0,
    skipped: 0,
  };

  try {
    const candidates = await prisma.upcomingGame.findMany({
      where: {
        scheduledFor: { gte: windowStart, lte: windowEnd },
        OR: [
          { importJob: null },
          { importJob: { isNot: { state: "IMPORTED" } } },
        ],
      },
      include: { importJob: true },
      orderBy: { scheduledFor: "asc" },
    });

    summary.candidates = candidates.length;

    for (const game of candidates) {
      try {
        const handled = await handleCandidate(game, now, summary);
        if (!handled) summary.skipped++;
      } catch (err) {
        summary.errors++;
        auditLog("discover_and_import_candidate_error", {
          upcomingGameId: game.id,
          opponent: game.opponent,
          error: (err as Error).message,
        });
      }
    }

    auditLog("cron_discover_and_import", { ...summary });
    await finishCronRun(runId, {
      ok: true,
      summary: summary as unknown as Record<string, unknown>,
    });
    if (summary.imported > 0) {
      await Promise.allSettled(["/", "/players", "/leaderboard", "/games", "/team-stats"].map(p => res.revalidate?.(p)));
    }
    return res.status(200).json({ ok: true, ...summary });
  } catch (err) {
    console.error("[discover-and-import]", err);
    await finishCronRun(runId, {
      ok: false,
      error: (err as Error).message,
    }).catch((finishErr) => {
      console.error(
        "[discover-and-import] failed to record cron failure:",
        finishErr,
      );
    });
    return res.status(500).json({ error: "Internal server error" });
  }
}

type Candidate = Awaited<
  ReturnType<typeof prisma.upcomingGame.findMany>
>[number] & {
  importJob: Awaited<ReturnType<typeof prisma.gameImportJob.findUnique>> | null;
};

async function handleCandidate(
  game: Candidate,
  now: Date,
  summary: RunSummary,
): Promise<boolean> {
  const job = game.importJob ?? null;

  if (job?.state === "ABANDONED") {
    auditLog("discover_skip", {
      reason: "abandoned",
      upcomingGameId: game.id,
      opponent: game.opponent,
    });
    return false;
  }

  // sourceUrl already known -> straight to processJob
  if (game.sourceUrl) {
    const ensuredJob =
      job ??
      (await prisma.gameImportJob.create({
        data: {
          upcomingGameId: game.id,
          sourceUrl: game.sourceUrl,
          state: "PENDING",
        },
      }));
    if (ensuredJob.state === "PENDING") {
      await processJob(ensuredJob.id);
      const after = await prisma.gameImportJob.findUniqueOrThrow({
        where: { id: ensuredJob.id },
      });
      if (after.state === "IMPORTED") summary.imported++;
    } else {
      auditLog("discover_skip", {
        reason: `job-state-${ensuredJob.state}`,
        upcomingGameId: game.id,
        opponent: game.opponent,
        jobId: ensuredJob.id,
      });
    }
    return true;
  }

  if (!game.listingUrl) {
    auditLog("discover_skip", {
      reason: "no-listing-url",
      upcomingGameId: game.id,
      opponent: game.opponent,
    });
    return false;
  }

  const attempts = job?.attempts ?? 0;
  if (attempts >= MAX_DISCOVERY_TRIES) {
    auditLog("discover_skip", {
      reason: "max-tries-exhausted",
      upcomingGameId: game.id,
      opponent: game.opponent,
      attempts,
    });
    return false;
  }

  const dueAt = new Date(
    game.scheduledFor.getTime() + (attempts + 1) * HOUR_MS,
  );
  if (dueAt > now) return false; // intentionally NOT logged - fires every hour

  let discovered: Awaited<ReturnType<typeof discoverSourceUrl>>;
  try {
    discovered = await discoverSourceUrl({
      listingUrl: game.listingUrl,
      scheduledFor: game.scheduledFor,
      opponent: game.opponent,
    });
  } catch (err) {
    const reason =
      err instanceof ListingFetchError ? err.message : (err as Error).message;
    await recordDiscoveryMiss(
      game,
      job,
      reason,
      attempts + 1,
      summary,
      /*transient*/ err instanceof ListingFetchError,
    );
    return true;
  }

  if (!discovered.gameUrl) {
    await recordDiscoveryMiss(
      game,
      job,
      discovered.reason,
      attempts + 1,
      summary,
      false,
    );
    return true;
  }

  // Found - promote to a normal import
  await prisma.upcomingGame.update({
    where: { id: game.id },
    data: { sourceUrl: discovered.gameUrl },
  });

  const liveJob = job
    ? await prisma.gameImportJob.update({
        where: { id: job.id },
        data: {
          sourceUrl: discovered.gameUrl,
          state: "PENDING",
          attempts: 0,
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          lastAttemptAt: new Date(),
        },
      })
    : await prisma.gameImportJob.create({
        data: {
          upcomingGameId: game.id,
          sourceUrl: discovered.gameUrl,
          state: "PENDING",
        },
      });

  summary.discovered++;
  auditLog("discover_source_url_match", {
    upcomingGameId: game.id,
    opponent: game.opponent,
    gameUrl: discovered.gameUrl,
    matchReason: discovered.reason,
  });

  await processJob(liveJob.id);
  const after = await prisma.gameImportJob.findUniqueOrThrow({
    where: { id: liveJob.id },
  });
  if (after.state === "IMPORTED") summary.imported++;
  return true;
}

async function recordDiscoveryMiss(
  game: Candidate,
  job: Candidate["importJob"] | null,
  reason: string,
  newAttempts: number,
  summary: RunSummary,
  transient: boolean,
): Promise<void> {
  // Transient upstream failure: keep attempts unchanged so a Cloudflare blip
  // doesn't burn the 4-hour discovery window. Only genuine misses (parsed listing,
  // no row) count toward MAX_DISCOVERY_TRIES.
  const attempts = transient ? (job?.attempts ?? 0) : newAttempts;
  const isAbandoned = !transient && newAttempts >= MAX_DISCOVERY_TRIES;
  const data = {
    state: isAbandoned ? ("ABANDONED" as const) : ("PENDING" as const),
    attempts,
    lastError: `discovery: ${reason}`,
    lastAttemptAt: new Date(),
    lockedAt: null,
    lockedBy: null,
  };

  const updatedJob = job
    ? await prisma.gameImportJob.update({ where: { id: job.id }, data })
    : await prisma.gameImportJob.create({
        data: { upcomingGameId: game.id, sourceUrl: null, ...data },
      });

  auditLog("discover_source_url_miss", {
    upcomingGameId: game.id,
    opponent: game.opponent,
    attempts,
    reason,
    transient,
    abandoned: isAbandoned,
  });

  if (isAbandoned) {
    summary.abandoned++;
    if (!updatedJob.failureSentAt) {
      await sendImportNotification({
        kind: "abandoned",
        opponent: game.opponent,
        location: game.location,
        scheduledFor: game.scheduledFor.toISOString(),
        attempts,
        lastError: `discovery: ${reason}`,
        matchReason: reason, // NEW
      }).catch((err) =>
        console.error("[discover-and-import notify abandoned]", err),
      );
      await prisma.gameImportJob.update({
        where: { id: updatedJob.id },
        data: { failureSentAt: new Date() },
      });
    }
  }
}
