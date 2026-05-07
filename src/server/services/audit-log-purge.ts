import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

const AUDIT_LOG_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export async function purgeAuditLogs(): Promise<number> {
  const cutoff = new Date(Date.now() - AUDIT_LOG_TTL_MS);
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
