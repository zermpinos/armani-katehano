import { timingSafeEqual } from "node:crypto";
import prisma                   from "@/server/db/client";
import { sendImportHeartbeat }  from "@/server/integrations/email/client";
import { securityHeaders }      from "@/server/security/edge";
import { auditLog }             from "@/server/security/node";

const DAY_MS  = 24 * 60 * 60 * 1000;

export default async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const secret   = process.env.CRON_SECRET;
  const auth     = String(req.headers["authorization"] ?? "");
  const expected = `Bearer ${secret ?? ""}`;
  if (!secret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now             = new Date();
  const last24h         = new Date(now.getTime() - DAY_MS);
  const sevenDaysAgo    = new Date(now.getTime() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
  const sevenDaysAhead  = new Date(now.getTime() + 7 * DAY_MS);

  try {
    const runs = await prisma.cronRun.findMany({
      where:   { job: "discover-and-import", startedAt: { gte: last24h } },
      orderBy: { startedAt: "desc" },
    });

    const inWindow = await prisma.upcomingGame.findMany({
      where: {
        scheduledFor: { gte: sevenDaysAgo, lte: now },
        OR: [
          { importJob: null },
          { importJob: { isNot: { state: "IMPORTED" } } },
        ],
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
