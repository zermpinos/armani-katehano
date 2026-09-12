import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

export const CRON_JOBS = [
  "purgeSubscribers",
  "purgeUpcomingGames",
  "purgeAuditLog",
  "pollImports",
  "cleanup",
] as const;

// Hobby fires each expression once a day and only guarantees the hour, so a
// flat 24h threshold flaps on ordinary jitter. 26h absorbs it and still catches
// a genuinely missed day.
const STALE_AFTER_MS = 26 * 60 * 60 * 1000;
const CRON_RUN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

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
      summary:    (opts.summary ?? undefined) as any,
      error:      opts.error ?? null,
      finishedAt: new Date(),
    },
  });
}

export interface JobFreshness {
  job:      string;
  lastOkAt: string | null;
  stale:    boolean;
}

// A job that fails writes a row; a job that never fires writes nothing. Both are
// reported as stale here so silence is not mistaken for health.
export async function cronFreshness(): Promise<JobFreshness[]> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  const rows = await prisma.cronRun.groupBy({
    by:    ["job"],
    where: { ok: true },
    _max:  { finishedAt: true },
  });

  const latest = new Map(rows.map(r => [r.job, r._max.finishedAt]));
  return CRON_JOBS.map(job => {
    const lastOkAt = latest.get(job) ?? null;
    return {
      job,
      lastOkAt: lastOkAt ? lastOkAt.toISOString() : null,
      stale:    !lastOkAt || lastOkAt < cutoff,
    };
  });
}

export async function purgeCronRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - CRON_RUN_TTL_MS);
  const { count } = await prisma.cronRun.deleteMany({
    where: { startedAt: { lt: cutoff } },
  });
  return count;
}
