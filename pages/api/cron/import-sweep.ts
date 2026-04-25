import prisma                              from "@/server/db/client";
import { processJob, purgeStaleErrorHtml } from "@/server/services/import-job";
import { securityHeaders, auditLog }       from "@/server/security";

const SWEEP_WINDOW_DAYS = 6;

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers["authorization"] ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const windowStart = new Date(Date.now() - SWEEP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  try {
    await purgeStaleErrorHtml();

    // UpcomingGames: in window, sourceUrl set, no IMPORTED job
    const candidates = await prisma.upcomingGame.findMany({
      where: {
        scheduledFor: { gte: windowStart, lte: new Date() },
        sourceUrl:    { not: null },
        importJobs:   { none: { state: "IMPORTED" } },
      },
      include: { importJobs: true },
    });

    const jobIds: string[] = [];

    for (const game of candidates) {
      // upcomingGameId is unique on GameImportJob -- at most one job per game
      const job = game.importJobs[0];

      if (!job) {
        const created = await prisma.gameImportJob.create({
          data: { upcomingGameId: game.id, sourceUrl: game.sourceUrl, state: "PENDING" },
        });
        jobIds.push(created.id);
      } else if (job.state === "ERROR") {
        // Give one more attempt -- reset to PENDING so processJob can claim it
        await prisma.gameImportJob.update({
          where: { id: job.id },
          data:  { state: "PENDING", lockedAt: null, lockedBy: null },
        });
        jobIds.push(job.id);
      } else if (job.state === "PENDING") {
        jobIds.push(job.id);
      }
      // ABANDONED -- skip
    }

    for (const jobId of jobIds) {
      await processJob(jobId);
    }

    auditLog("cron_import_sweep", { candidates: candidates.length, processed: jobIds.length });
    return res.status(200).json({ ok: true, candidates: candidates.length, processed: jobIds.length });
  } catch (err) {
    console.error("[import-sweep]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
