/**
 * pages/api/coach/roster-announcement.ts
 *
 * GET    ?upcomingGameId=<id>  -> fetch announcement for a game (null if none)
 * POST                         -> create or replace announcement
 * DELETE                       -> remove announcement
 *
 * Protected by coach session (requireCoachAuth).
 */

import { requireCoachAuth, rlKey, rlKeyBigInt } from "@/server/auth";
import { auditLog, getClientIp } from "@/server/security/node";
import prisma from "@/server/db/client";
import { prodError } from "@/domain/shared/format";
import { sendRosterAnnouncement } from "@/server/integrations/email/client";
import { CoachAnnouncementWriteSchema, AnnouncementDeleteSchema } from "@/schemas/roster-announcement";
import { invalidateForRosterAnnouncement } from "@/server/services/cache-invalidation";

const BLAST_LIMIT  = 10;   // max roster saves per IP per hour
const BLAST_WINDOW = 3600; // 1 hour in seconds

// Roster emails are capped globally, not per caller, so every send contends one key.
const EMAIL_KEY       = "roster_email";
const EMAIL_GAP_MS    = 10 * 60_000;
const EMAIL_WINDOW_MS = 86_400_000;
const EMAIL_DAILY_MAX = 3;

async function claimEmailSlot(): Promise<boolean> {
  const key = rlKey(EMAIL_KEY);
  return prisma.$transaction(async (tx) => {
    // $executeRaw, not $queryRaw: pg_advisory_xact_lock() returns void, which
    // @prisma/adapter-neon refuses to deserialize (P2010).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${rlKeyBigInt(EMAIL_KEY)}::bigint)`;
    const now  = Date.now();
    const sent = await tx.loginAttempt.findMany({
      where:  { ip: key, attemptedAt: { gte: new Date(now - EMAIL_WINDOW_MS) } },
      select: { attemptedAt: true },
    });
    if (sent.length >= EMAIL_DAILY_MAX) return false;
    if (sent.some(r => r.attemptedAt.getTime() > now - EMAIL_GAP_MS)) return false;
    await tx.loginAttempt.create({ data: { ip: key } });
    return true;
  });
}

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
            include: { player: { select: { id: true, name: true, number: true, position: true, photoUrl: true } } },
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
    // Rate-limit saves: max 10 per IP per hour
    const blastKey = rlKey(`blast_${ip}`);
    const blastSince = new Date(Date.now() - BLAST_WINDOW * 1000);
    const blastCount = await prisma.loginAttempt.count({
      where: { ip: blastKey, attemptedAt: { gte: blastSince } },
    });
    if (blastCount >= BLAST_LIMIT) {
      await auditLog("roster_blast_rate_limited", { ip });
      return res.status(429).json({ error: "Too many announcements. Try again later." });
    }
    await prisma.loginAttempt.create({ data: { ip: blastKey } })
      .catch((err: unknown) => console.error("[roster-announcement] rate-limit record failed:", err));

    const parsed = CoachAnnouncementWriteSchema.safeParse(req.body ?? {});
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
        include: { players: { include: { player: { select: { name: true, number: true, photoUrl: true } } } } },
      });
      if (!existing) return res.status(404).json({ error: "No announcement to resend" });

      if (!(await claimEmailSlot())) {
        await auditLog("roster_email_rate_limited", { ip, upcomingGameId });
        return res.status(429).json({
          error: "Roster emails are limited to one every 10 minutes and 3 a day. Try again later.",
        });
      }

      try {
        const subscribers = await prisma.subscriber.findMany({ where: { confirmedAt: { not: null } } });
        if (subscribers.length > 0) {
          await sendRosterAnnouncement({
            game: { opponent: game.opponent, scheduledFor: game.scheduledFor.toISOString(), location: game.location, competition: game.competition ?? null, notes: game.notes ?? null },
            players: existing.players.map(sp => ({ name: sp.player.name, number: sp.player.number, note: sp.note ?? null, photoUrl: sp.player.photoUrl ?? null })),
            message: existing.message ?? null,
            subscribers: subscribers.map(s => ({ id: s.id, email: s.email, token: s.token })),
          });
        }
      } catch (err) {
        await auditLog("roster_resend_error", { error: (err as any).message });
      }

      await auditLog("coach_roster_resend", { ip, upcomingGameId });
      return res.status(200).json({ ok: true });
    }

    if (!players || players.length === 0) {
      return res.status(400).json({ error: "players: Select at least one player" });
    }

    try {
      const { announcement, created } = await prisma.$transaction(async (tx) => {
        const existing = await tx.gameRosterAnnouncement.findUnique({ where: { upcomingGameId } });

        if (existing) {
          await tx.gameRosterPlayer.deleteMany({ where: { announcementId: existing.id } });
          const updated = await tx.gameRosterAnnouncement.update({
            where: { upcomingGameId },
            data: {
              message:     message ?? null,
              publishedAt: new Date(),
              players: {
                create: players.map(p => ({ playerId: p.playerId, note: p.note ?? null })),
              },
            },
            include: { players: { include: { player: { select: { id: true, name: true, number: true, photoUrl: true } } } } },
          });
          return { announcement: updated, created: false };
        }

        const fresh = await tx.gameRosterAnnouncement.create({
          data: {
            upcomingGameId,
            message: message ?? null,
            players: {
              create: players.map(p => ({ playerId: p.playerId, note: p.note ?? null })),
            },
          },
          include: { players: { include: { player: { select: { id: true, name: true, number: true, photoUrl: true } } } } },
        });
        return { announcement: fresh, created: true };
      });

      await auditLog("coach_roster_published", { ip, upcomingGameId, playerCount: players.length });

      await invalidateForRosterAnnouncement({ revalidate: res.revalidate });

      // Only the first publish emails; a corrected roster goes out through RESEND EMAIL.
      let email: "sent" | "update" | "limit" = created ? "sent" : "update";
      // Awaited so Vercel doesn't kill the function before the send finishes.
      try {
        if (created && !(await claimEmailSlot())) {
          email = "limit";
          await auditLog("roster_email_rate_limited", { ip, upcomingGameId });
        }
        const subscribers = email === "sent"
          ? await prisma.subscriber.findMany({ where: { confirmedAt: { not: null } } })
          : [];
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
              name:     sp.player.name,
              number:   sp.player.number,
              note:     sp.note ?? null,
              photoUrl: sp.player.photoUrl ?? null,
            })),
            message: message ?? null,
            subscribers: subscribers.map(s => ({ id: s.id, email: s.email, token: s.token })),
          });
        }
      } catch (err) {
        await auditLog("roster_email_trigger_error", { error: (err as any).message });
      }

      return res.status(200).json({ ok: true, id: announcement.id, email });
    } catch (err) {
      await auditLog("coach_roster_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
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
      await auditLog("coach_roster_deleted", { ip, upcomingGameId });
      await invalidateForRosterAnnouncement({ revalidate: res.revalidate });
      return res.status(200).json({ ok: true });
    } catch (err) {
      await auditLog("coach_roster_delete_error", { ip, error: (err as any).message });
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireCoachAuth(handler);
