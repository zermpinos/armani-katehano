/**
 * pages/api/admin/schedule.ts
 * POST   /api/admin/schedule → create upcoming game
 * PUT    /api/admin/schedule → edit upcoming game
 * DELETE /api/admin/schedule → delete upcoming game
 * GET    /api/admin/schedule → list all upcoming games (including past ones for admin)
 */

import { z } from "zod";
import { requireAuth } from "../../../lib/requireAuth";
import { securityHeaders, auditLog } from "../../../lib/security";
import prisma from "../../../lib/prisma";
import { prodError } from "../../../lib/utils";

const ScheduleWriteSchema = z.object({
  opponent: z.string().min(1).max(100),
  scheduledFor: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  location: z.enum(["home", "away"]).default("home"),
  competition: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const ScheduleUpdateSchema = ScheduleWriteSchema.extend({
  id: z.string().cuid(),
});

const ScheduleDeleteSchema = z.object({
  id: z.string().cuid(),
});

async function handler(req: any, res: any) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── LIST ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const games = await prisma.upcomingGame.findMany({
        orderBy: { scheduledFor: "asc" },
      });

      return res.status(200).json({
        schedule: games.map(g => ({
          id: g.id,
          opponent: g.opponent,
          scheduledFor: g.scheduledFor.toISOString(),
          location: g.location,
          competition: g.competition ?? null,
          notes: g.notes ?? null,
        })),
      });
    } catch (err) {
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = ScheduleWriteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") });
    }
    const { opponent, scheduledFor, location, competition, notes } = parsed.data;

    try {
      const game = await prisma.upcomingGame.create({
        data: {
          opponent,
          scheduledFor: new Date(scheduledFor),
          location,
          competition: competition ?? null,
          notes: notes ?? null,
        },
      });
      auditLog("schedule_created", { ip, gameId: game.id, opponent });
      return res.status(201).json({ ok: true, id: game.id });
    } catch (err) {
      auditLog("schedule_create_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const parsed = ScheduleUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") });
    }
    const { id, opponent, scheduledFor, location, competition, notes } = parsed.data;

    try {
      await prisma.upcomingGame.update({
        where: { id },
        data: {
          opponent,
          scheduledFor: new Date(scheduledFor),
          location,
          competition: competition ?? null,
          notes: notes ?? null,
        },
      });
      auditLog("schedule_updated", { ip, gameId: id, opponent });
      return res.status(200).json({ ok: true });
    } catch (err) {
      auditLog("schedule_update_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const parsed = ScheduleDeleteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") });
    }
    const { id } = parsed.data;

    try {
      await prisma.upcomingGame.delete({ where: { id } });
      auditLog("schedule_deleted", { ip, gameId: id });
      return res.status(200).json({ ok: true });
    } catch (err) {
      auditLog("schedule_delete_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
