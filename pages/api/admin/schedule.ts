/**
 * pages/api/admin/schedule.ts
 * POST   /api/admin/schedule -> create upcoming game
 * PUT    /api/admin/schedule -> edit upcoming game
 * DELETE /api/admin/schedule -> delete upcoming game
 * GET    /api/admin/schedule -> list all upcoming games (including past ones for admin)
 */

import { requireAuth } from "@/server/auth";
import { auditLog, getClientIp } from "@/server/security/node";
import prisma from "@/server/db/client";
import { ScheduleWriteSchema, ScheduleUpdateSchema, ScheduleDeleteSchema } from "@/schemas/schedule";
import { handleError }  from "@/server/http/handle-error";
import { parseBody }    from "@/server/http/parse-body";
import { methodRouter } from "@/server/http/method-router";

const ISR_PATHS = ["/", "/games"];

async function listSchedule(_req: any, res: any) {
  try {
    const games = await prisma.upcomingGame.findMany({
      orderBy: { scheduledFor: "asc" },
    });
    return res.status(200).json({
      schedule: games.map(g => ({
        id:           g.id,
        opponent:     g.opponent,
        scheduledFor: g.scheduledFor.toISOString(),
        location:     g.location,
        competition:  g.competition ?? null,
        notes:        g.notes ?? null,
        sourceUrl:    g.sourceUrl ?? null,
      })),
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function createSchedule(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(ScheduleWriteSchema, req.body, res);
  if (!data) return;
  const { opponent, scheduledFor, location, competition, notes, sourceUrl } = data;

  try {
    const game = await prisma.upcomingGame.create({
      data: {
        opponent,
        scheduledFor: new Date(scheduledFor),
        location,
        competition: competition ?? null,
        notes: notes ?? null,
        sourceUrl: sourceUrl ?? null,
      },
    });
    auditLog("schedule_created", { ip, gameId: game.id, opponent });
    await Promise.allSettled(ISR_PATHS.map(p => res.revalidate?.(p)));
    return res.status(201).json({ ok: true, id: game.id });
  } catch (err) {
    auditLog("schedule_create_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

async function updateSchedule(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(ScheduleUpdateSchema, req.body, res);
  if (!data) return;
  const { id, opponent, scheduledFor, location, competition, notes, sourceUrl } = data;

  try {
    await prisma.upcomingGame.update({
      where: { id },
      data: {
        opponent,
        scheduledFor: new Date(scheduledFor),
        location,
        competition: competition ?? null,
        notes: notes ?? null,
        sourceUrl: sourceUrl ?? null,
      },
    });

    auditLog("schedule_updated", { ip, gameId: id, opponent });
    await Promise.allSettled(ISR_PATHS.map(p => res.revalidate?.(p)));
    return res.status(200).json({ ok: true });
  } catch (err) {
    auditLog("schedule_update_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

async function deleteSchedule(req: any, res: any) {
  const ip   = getClientIp(req);
  const data = parseBody(ScheduleDeleteSchema, req.body, res);
  if (!data) return;
  const { id } = data;

  try {
    await prisma.upcomingGame.delete({ where: { id } });
    auditLog("schedule_deleted", { ip, gameId: id });
    await Promise.allSettled(ISR_PATHS.map(p => res.revalidate?.(p)));
    return res.status(200).json({ ok: true });
  } catch (err) {
    auditLog("schedule_delete_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

export default requireAuth(methodRouter({
  GET:    listSchedule,
  POST:   createSchedule,
  PUT:    updateSchedule,
  DELETE: deleteSchedule,
}));
