/**
 * pages/api/coach/roster-announcement.ts
 *
 * GET    ?upcomingGameId=<id>  -> fetch announcement for a game (null if none)
 * POST                         -> create or replace announcement
 * DELETE                       -> remove announcement
 *
 * Protected by coach session (requireCoachAuth).
 */

import { z } from "zod";
import { requireCoachAuth } from "../../../lib/requireCoachAuth";
import { auditLog } from "../../../lib/security";
import prisma from "../../../lib/prisma";
import { prodError } from "../../../lib/utils";

const PlayerSlotSchema = z.object({
  playerId: z.string().cuid(),
  note:     z.string().max(200).optional().nullable(),
});

const WriteSchema = z.object({
  upcomingGameId: z.string().cuid(),
  message:        z.string().max(1000).optional().nullable(),
  players:        z.array(PlayerSlotSchema).min(1).max(20),
});

const DeleteSchema = z.object({
  upcomingGameId: z.string().cuid(),
});

async function handler(req: any, res: any) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── GET ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const id = req.query.upcomingGameId;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "upcomingGameId query param required" });
    }
    try {
      const announcement = await prisma.gameRosterAnnouncement.findUnique({
        where:   { upcomingGameId: id },
        include: {
          players: {
            include: { player: { select: { id: true, name: true, number: true, position: true } } },
            orderBy: { player: { number: "asc" } },
          },
        },
      });
      return res.status(200).json({ announcement: announcement ?? null });
    } catch (err) {
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── POST: create / replace ────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = WriteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const { upcomingGameId, message, players } = parsed.data;

    const game = await prisma.upcomingGame.findUnique({ where: { id: upcomingGameId } });
    if (!game) return res.status(404).json({ error: "Upcoming game not found" });

    try {
      const announcement = await prisma.$transaction(async (tx) => {
        const existing = await tx.gameRosterAnnouncement.findUnique({ where: { upcomingGameId } });

        if (existing) {
          await tx.gameRosterPlayer.deleteMany({ where: { announcementId: existing.id } });
          return tx.gameRosterAnnouncement.update({
            where: { upcomingGameId },
            data: {
              message:     message ?? null,
              publishedAt: new Date(),
              players: {
                create: players.map(p => ({ playerId: p.playerId, note: p.note ?? null })),
              },
            },
            include: { players: { include: { player: { select: { id: true, name: true, number: true } } } } },
          });
        }

        return tx.gameRosterAnnouncement.create({
          data: {
            upcomingGameId,
            message: message ?? null,
            players: {
              create: players.map(p => ({ playerId: p.playerId, note: p.note ?? null })),
            },
          },
          include: { players: { include: { player: { select: { id: true, name: true, number: true } } } } },
        });
      });

      auditLog("coach_roster_published", { ip, upcomingGameId, playerCount: players.length });
      return res.status(200).json({ ok: true, id: announcement.id });
    } catch (err) {
      auditLog("coach_roster_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const parsed = DeleteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const { upcomingGameId } = parsed.data;

    try {
      await prisma.gameRosterAnnouncement.delete({ where: { upcomingGameId } });
      auditLog("coach_roster_deleted", { ip, upcomingGameId });
      return res.status(200).json({ ok: true });
    } catch (err) {
      auditLog("coach_roster_delete_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireCoachAuth(handler);
