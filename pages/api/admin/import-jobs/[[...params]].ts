/**
 * pages/api/admin/import-jobs/[[...params]].ts
 *
 * GET  /api/admin/import-jobs                    -> list all jobs
 * POST /api/admin/import-jobs/:id/run-now        -> reset to PENDING + process immediately
 * POST /api/admin/import-jobs/:id/abandon        -> mark ABANDONED
 * POST /api/admin/import-jobs/:id/reset          -> reset to PENDING (attempts=0, clear error)
 */

import { requireAuth }                            from "@/server/auth";
import { auditLog, getClientIp }                  from "@/server/security/node";
import prisma                                     from "@/server/db/client";
import { processJob }                             from "@/server/services/import-job";
import { handleError }                            from "@/server/http/handle-error";

function toDto(j: {
  id: string; upcomingGameId: string; state: string; attempts: number;
  lastError: string | null; sourceUrl: string | null;
  importedAt: Date | null; updatedAt: Date;
}) {
  return {
    id:            j.id,
    upcomingGameId: j.upcomingGameId,
    state:         j.state,
    attempts:      j.attempts,
    lastError:     j.lastError ?? null,
    sourceUrl:     j.sourceUrl ?? null,
    importedAt:    j.importedAt?.toISOString() ?? null,
    updatedAt:     j.updatedAt.toISOString(),
  };
}

async function listJobs(_req: any, res: any) {
  try {
    const jobs = await prisma.gameImportJob.findMany({ orderBy: { updatedAt: "desc" } });
    return res.status(200).json({ jobs: jobs.map(toDto) });
  } catch (err) {
    return handleError(res, err);
  }
}

async function runNow(req: any, res: any, id: string) {
  const ip = getClientIp(req);
  try {
    const job = await prisma.gameImportJob.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.state === "IMPORTED") return res.status(400).json({ error: "Already imported" });

    await prisma.gameImportJob.update({
      where: { id },
      data:  { state: "PENDING", lockedAt: null, lockedBy: null },
    });

    await processJob(id);

    const updated = await prisma.gameImportJob.findUniqueOrThrow({ where: { id } });
    auditLog("import_job_run_now", { ip, jobId: id, resultState: updated.state });
    if (updated.state === "IMPORTED") {
      await Promise.allSettled(["/", "/players", "/leaderboard", "/games", "/team-stats"].map(p => res.revalidate?.(p)));
    }
    return res.status(200).json({ ok: true, job: toDto(updated) });
  } catch (err) {
    return handleError(res, err);
  }
}

async function abandon(req: any, res: any, id: string) {
  const ip = getClientIp(req);
  try {
    const job = await prisma.gameImportJob.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: "Job not found" });

    await prisma.gameImportJob.update({
      where: { id },
      data:  { state: "ABANDONED", lockedAt: null, lockedBy: null },
    });
    auditLog("import_job_abandoned", { ip, jobId: id });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

async function reset(req: any, res: any, id: string) {
  const ip = getClientIp(req);
  try {
    const job = await prisma.gameImportJob.findUnique({ where: { id } });
    if (!job) return res.status(404).json({ error: "Job not found" });

    await prisma.gameImportJob.update({
      where: { id },
      data:  {
        state:         "PENDING",
        attempts:      0,
        lockedAt:      null,
        lockedBy:      null,
        lastError:     null,
        lastErrorHtml: null,
        failureSentAt: null,
        successSentAt: null,
      },
    });
    auditLog("import_job_reset", { ip, jobId: id });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return handleError(res, err);
  }
}

export default requireAuth(async function handler(req: any, res: any) {
  const params = req.query.params as string[] | undefined;

  if (!params || params.length === 0) {
    if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
    return listJobs(req, res);
  }

  if (params.length === 2 && req.method === "POST") {
    const [id, action] = params;
    if (action === "run-now")  return runNow(req, res, id);
    if (action === "abandon")  return abandon(req, res, id);
    if (action === "reset")    return reset(req, res, id);
  }

  return res.status(404).json({ error: "Not found" });
});
