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
import { auditLog, getClientIp } from "../../../lib/security";
import prisma from "../../../lib/prisma";
import { prodError } from "../../../lib/utils";
import { sendRosterAnnouncement } from "../../../lib/email";

const BLAST_LIMIT  = 10;   // max email blasts per IP per hour
const BLAST_WINDOW = 3600; // 1 hour in seconds

const PlayerSlotSchema = z.object({
  playerId: z.string().cuid(),
  note:     z.string().max(200).optional().nullable(),
});

const WriteSchema = z.object({
  upcomingGameId: z.string().cuid(),
  message:        z.string().max(1000).optional().nullable(),
  players:        z.array(PlayerSlotSchema).max(20).optional(),
  resend:         z.boolean().optional(),
});

const DeleteSchema = z.object({
  upcomingGameId: z.string().cuid(),
});

async function handler(req: any, res: any) {
  const ip = getClientIp(req);

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
    // Rate-limit email blasts: max 10 per IP per hour
    const blastKey = `blast_${ip}`;
    const blastSince = new Date(Date.now() - BLAST_WINDOW * 1000);
    const blastCount = await prisma.loginAttempt.count({
      where: { ip: blastKey, attemptedAt: { gte: blastSince } },
    });
    if (blastCount >= BLAST_LIMIT) {
      auditLog("roster_blast_rate_limited", { ip });
      return res.status(429).json({ error: "Too many announcements. Try again later." });
    }
    prisma.loginAttempt.create({ data: { ip: blastKey } })
      .catch((err: unknown) => console.error("[roster-announcement] rate-limit record failed:", err));

    const parsed = WriteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const { upcomingGameId, message, players, resend } = parsed.data;

    const game = await prisma.upcomingGame.findUnique({ where: { id: upcomingGameId } });
    if (!game) return res.status(404).json({ error: "Upcoming game not found" });

    // ── Resend-only path ─────────────────────────────────────────────────────
    if (resend) {
      const existing = await prisma.gameRosterAnnouncement.findUnique({
        where:   { upcomingGameId },
        include: { players: { include: { player: { select: { name: true, number: true } } } } },
      });
      if (!existing) return res.status(404).json({ error: "No announcement to resend" });

      try {
        const subscribers = await prisma.subscriber.findMany({ where: { confirmedAt: { not: null } } });
        if (subscribers.length > 0) {
          await sendRosterAnnouncement({
            game: { opponent: game.opponent, scheduledFor: game.scheduledFor.toISOString(), location: game.location, competition: game.competition ?? null, notes: game.notes ?? null },
            players: existing.players.map(sp => ({ name: sp.player.name, number: sp.player.number, note: sp.note ?? null })),
            message: existing.message ?? null,
            subscribers: subscribers.map(s => ({ email: s.email, token: s.token })),
          });
        }
      } catch (err) {
        auditLog("roster_resend_error", { error: (err as any).message });
      }

      auditLog("coach_roster_resend", { ip, upcomingGameId });
      return res.status(200).json({ ok: true });
    }

    if (!players || players.length === 0) {
      return res.status(400).json({ error: "players: Select at least one player" });
    }

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

      // Send emails to all confirmed subscribers -- awaited so Vercel doesn't kill the function early.
      try {
        const subscribers = await prisma.subscriber.findMany({ where: { confirmedAt: { not: null } } });
        if (subscribers.length > 0) {
          await sendRosterAnnouncement({
            game: {
              opponent:     game.opponent,
              scheduledFor: game.scheduledFor.toISOString(),
              location:     game.location,
              competition:  game.competition ?? null,
              notes:        game.notes ?? null,
            },
            players: announcement.players.map(sp => ({
              name:   sp.player.name,
              number: sp.player.number,
              note:   sp.note ?? null,
            })),
            message: message ?? null,
            subscribers: subscribers.map(s => ({ email: s.email, token: s.token })),
          });
        }
      } catch (err) {
        auditLog("roster_email_trigger_error", { error: (err as any).message });
      }

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
