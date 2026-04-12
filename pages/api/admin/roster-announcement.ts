/**
 * pages/api/admin/roster-announcement.ts
 *
 * GET    ?upcomingGameId=<id>  -> fetch announcement for a game (null if none)
 * POST                         -> create or replace announcement for a game
 * DELETE                       -> remove announcement
 */

import { z } from "zod";
import { requireAuth } from "../../../lib/requireAuth";
import { auditLog, getClientIp } from "../../../lib/security";
import prisma from "../../../lib/prisma";
import { prodError } from "../../../lib/utils";

const PlayerSlotSchema = z.object({
  playerId: z.string().cuid(),
  note: z.string().max(200).optional().nullable(),
});

const AnnouncementWriteSchema = z.object({
  upcomingGameId: z.string().cuid(),
  message: z.string().max(1000).optional().nullable(),
  players: z.array(PlayerSlotSchema).min(1).max(20),
});

const AnnouncementDeleteSchema = z.object({
  upcomingGameId: z.string().cuid(),
});

async function handler(req: any, res: any) {
  const ip = getClientIp(req);

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const id = req.query.upcomingGameId;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "upcomingGameId query param required" });
    }

    try {
      const announcement = await prisma.gameRosterAnnouncement.findUnique({
        where: { upcomingGameId: id },
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

  // ── CREATE / REPLACE ───────────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = AnnouncementWriteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const { upcomingGameId, message, players } = parsed.data;

    // Verify the upcoming game exists
    const game = await prisma.upcomingGame.findUnique({ where: { id: upcomingGameId } });
    if (!game) {
      return res.status(404).json({ error: "Upcoming game not found" });
    }

    try {
      // Upsert: delete existing player slots then recreate, wrapped in a transaction
      const announcement = await prisma.$transaction(async (tx) => {
        const existing = await tx.gameRosterAnnouncement.findUnique({
          where: { upcomingGameId },
        });

        if (existing) {
          await tx.gameRosterPlayer.deleteMany({ where: { announcementId: existing.id } });
          return tx.gameRosterAnnouncement.update({
            where: { upcomingGameId },
            data: {
              message: message ?? null,
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

      auditLog("roster_announcement_published", { ip, upcomingGameId, playerCount: players.length });
      return res.status(200).json({ ok: true, id: announcement.id });
    } catch (err) {
      auditLog("roster_announcement_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const parsed = AnnouncementDeleteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const { upcomingGameId } = parsed.data;

    try {
      await prisma.gameRosterAnnouncement.delete({ where: { upcomingGameId } });
      auditLog("roster_announcement_deleted", { ip, upcomingGameId });
      return res.status(200).json({ ok: true });
    } catch (err) {
      auditLog("roster_announcement_delete_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
