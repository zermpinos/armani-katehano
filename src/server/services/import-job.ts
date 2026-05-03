import "@/server/_internal/node-only";
import { randomBytes }      from "node:crypto";
import prisma               from "@/server/db/client";
import { scrapeGameFromUrl, ScrapeError } from "@/server/services/scrape-game";
import { importGame, ImportError }        from "@/server/services/import-game";
import { sendImportNotification }         from "@/server/integrations/email/client";

const MAX_ATTEMPTS        = 3;
const MAX_ERROR_HTML_BYTES = 50_000;

export function truncateHtml(html: string): string {
  if (html.length <= MAX_ERROR_HTML_BYTES) return html;
  return html.slice(0, MAX_ERROR_HTML_BYTES) + "\n[truncated]";
}

export async function processJob(jobId: string): Promise<void> {
  const workerId = randomBytes(4).toString("hex");

  // Claim via SELECT FOR UPDATE SKIP LOCKED — short transaction just to take the row lock
  const claimed = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "GameImportJob"
      WHERE id = ${jobId} AND state = 'PENDING'
      FOR UPDATE SKIP LOCKED
    `;
    if (rows.length === 0) return false;
    await tx.gameImportJob.update({
      where: { id: jobId },
      data:  { lockedAt: new Date(), lockedBy: workerId, attempts: { increment: 1 }, lastAttemptAt: new Date() },
    });
    return true;
  });

  if (!claimed) return;

  const job = await prisma.gameImportJob.findUniqueOrThrow({
    where:   { id: jobId },
    include: { upcomingGame: true },
  });

  async function notifySuccess(importedAt: Date) {
    if (job.successSentAt) return;
    await sendImportNotification({
      kind:         "success",
      opponent:     job.upcomingGame.opponent,
      location:     job.upcomingGame.location,
      scheduledFor: job.upcomingGame.scheduledFor.toISOString(),
      importedAt,
    }).catch(err => console.error("[import-job notify success]", err));
    await prisma.gameImportJob.update({ where: { id: jobId }, data: { successSentAt: new Date() } });
  }

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

  if (!job.sourceUrl) {
    await prisma.gameImportJob.update({
      where: { id: jobId },
      data:  { state: "ERROR", lastError: "No sourceUrl on job", lockedAt: null, lockedBy: null },
    });
    await notifyFailure("No sourceUrl on job");
    return;
  }

  // Scrape
  let scrapeResult: Awaited<ReturnType<typeof scrapeGameFromUrl>>;
  try {
    scrapeResult = await scrapeGameFromUrl(job.sourceUrl);
  } catch (err) {
    const msg  = err instanceof ScrapeError ? err.message : "Unexpected scrape error";
    const next = job.attempts >= MAX_ATTEMPTS ? "ERROR" : "PENDING";
    await prisma.gameImportJob.update({
      where: { id: jobId },
      data:  { state: next, lastError: msg, lockedAt: null, lockedBy: null },
    });
    if (next === "ERROR") await notifyFailure(msg);
    return;
  }

  const { data, gameState } = scrapeResult;

  // Email may have raced the page — requeue until final
  if (gameState.state !== "final") {
    const next = job.attempts >= MAX_ATTEMPTS ? "ERROR" : "PENDING";
    const msg  = `Not final after ${job.attempts} attempt(s): ${gameState.reason}`;
    await prisma.gameImportJob.update({
      where: { id: jobId },
      data:  { state: next, lastError: msg, lockedAt: null, lockedBy: null },
    });
    if (next === "ERROR") await notifyFailure(msg);
    return;
  }

  // Import
  try {
    const result    = await importGame({ data });
    const importedAt = new Date();
    await prisma.gameImportJob.update({
      where: { id: jobId },
      data:  {
        state:          "IMPORTED",
        importedGameId: result.gameId,
        importedAt,
        lastError:      null,
        lockedAt:       null,
        lockedBy:       null,
      },
    });
    await notifySuccess(importedAt);
  } catch (err) {
    if (err instanceof ImportError && err.status === 409) {
      const importedAt = new Date();
      await prisma.gameImportJob.update({
        where: { id: jobId },
        data:  {
          state:          "IMPORTED",
          importedGameId: (err as any).gameId ?? null,
          importedAt,
          lockedAt:       null,
          lockedBy:       null,
        },
      });
      await notifySuccess(importedAt);
      return;
    }
    const msg  = err instanceof ImportError ? err.message : "Unexpected import error";
    const next = job.attempts >= MAX_ATTEMPTS ? "ERROR" : "PENDING";
    await prisma.gameImportJob.update({
      where: { id: jobId },
      data:  { state: next, lastError: msg, lockedAt: null, lockedBy: null },
    });
    if (next === "ERROR") await notifyFailure(msg);
  }
}

// Called from the daily sweep — clears lastErrorHtml older than 30 days to keep the table lean
export async function purgeStaleErrorHtml(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.gameImportJob.updateMany({
    where: { lastErrorHtml: { not: null }, updatedAt: { lt: cutoff } },
    data:  { lastErrorHtml: null },
  });
}
