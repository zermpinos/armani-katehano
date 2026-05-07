/**
 * pages/api/cron/purge-audit-log.ts
 *
 * GET -- called daily by Vercel Cron. Deletes AuditLog rows older than 90 days.
 * Uses a time-based filter only -- no ID-range deletes.
 *
 * Auth: Vercel sends Authorization: Bearer <CRON_SECRET> automatically.
 */

import { timingSafeEqual } from "node:crypto";
import { securityHeaders }  from "@/server/security/edge";
import { startCronRun, finishCronRun } from "@/server/services/cron-run";
import { purgeAuditLogs }  from "@/server/services/audit-log-purge";

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret   = process.env.CRON_SECRET;
  const auth     = String(req.headers["authorization"] ?? "");
  const expected = `Bearer ${secret ?? ""}`;
  if (
    !secret ||
    auth.length !== expected.length ||
    !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const runId = await startCronRun("purgeAuditLog");

  try {
    const deleted = await purgeAuditLogs();
    await finishCronRun(runId, { ok: true, summary: { deleted } });
    return res.status(200).json({ ok: true, deleted });
  } catch (err: any) {
    await finishCronRun(runId, { ok: false, error: err.message });
    console.error("[purge-audit-log]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
