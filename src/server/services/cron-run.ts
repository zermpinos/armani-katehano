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
      summary:    (opts.summary ?? undefined) as any,
      error:      opts.error ?? null,
      finishedAt: new Date(),
    },
  });
}
