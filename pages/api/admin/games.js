/**
 * pages/api/admin/games.js
 * POST   /api/admin/games → create game + box score + recalc aggregates
 * PUT    /api/admin/games → edit game + box score + recalc aggregates
 * DELETE /api/admin/games → delete game + recalc aggregates
 */

import { z }                         from "zod";
import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security.js";
import prisma                        from "../../../lib/prisma.js";
import { recalcAggregates }          from "../../../lib/stats.prisma.js";

const BoxScoreRowSchema = z.object({
  playerId: z.string().cuid(),
  minutes:  z.coerce.number().int().min(0).max(60),
  pts:      z.coerce.number().int().min(0).max(200),
  reb:      z.coerce.number().int().min(0).max(100),
  ast:      z.coerce.number().int().min(0).max(100),
  stl:      z.coerce.number().int().min(0).max(50),
  blk:      z.coerce.number().int().min(0).max(50),
  tov:      z.coerce.number().int().min(0).max(50),
  pf:       z.coerce.number().int().min(0).max(6),
  fgm:      z.coerce.number().int().min(0).max(100),
  fga:      z.coerce.number().int().min(0).max(100),
  fg3m:     z.coerce.number().int().min(0).max(50),
  fg3a:     z.coerce.number().int().min(0).max(50),
  ftm:      z.coerce.number().int().min(0).max(50),
  fta:      z.coerce.number().int().min(0).max(50),
}).refine(r => r.fgm <= r.fga, { message: "fgm cannot exceed fga" })
  .refine(r => r.fg3m <= r.fg3a, { message: "fg3m cannot exceed fg3a" })
  .refine(r => r.ftm <= r.fta,   { message: "ftm cannot exceed fta" })
  .refine(r => r.fg3m <= r.fgm,  { message: "fg3m cannot exceed fgm" });

const GameWriteSchema = z.object({
  seasonLeagueId: z.string().cuid(),
  opponent:       z.string().min(1).max(100),
  location:       z.enum(["home", "away"]).default("away"),
  teamScore:      z.coerce.number().int().min(0).max(300),
  opponentScore:  z.coerce.number().int().min(0).max(300),
  result:         z.enum(["W", "L"]),
  playedOn:       z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes:          z.string().max(1000).optional().nullable(),
  boxScore:       z.array(BoxScoreRowSchema).max(20).optional(),
});

const GameUpdateSchema = GameWriteSchema.extend({
  gameId: z.string().cuid(),
});

const GameDeleteSchema = z.object({
  gameId:         z.string().cuid(),
  seasonLeagueId: z.string().cuid(),
});

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── CREATE ─────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = GameWriteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { seasonLeagueId, opponent, location, teamScore, opponentScore, result, playedOn, notes, boxScore } = parsed.data;

    try {
      const game = await prisma.$transaction(async (tx) => {
        const g = await tx.game.create({
          data: { seasonLeagueId, opponent, location, teamScore, opponentScore, result, playedOn: new Date(playedOn), notes: notes ?? null },
        });
        if (boxScore?.length) {
          await tx.playerGameStat.createMany({
            data: boxScore.map(r => ({
              playerId: r.playerId, gameId: g.id,
              minutes: r.minutes, pts: r.pts, reb: r.reb, ast: r.ast,
              stl: r.stl, blk: r.blk, to: r.tov, pf: r.pf,
              fgm: r.fgm, fga: r.fga, tpm: r.fg3m, tpa: r.fg3a,
              ftm: r.ftm, fta: r.fta, plusMinus: 0,
            })),
          });
        }
        await recalcAggregates(seasonLeagueId, tx);
        return g;
      });
      auditLog("game_created", { ip, gameId: game.id, opponent });
      return res.status(201).json({ ok: true, gameId: game.id });
    } catch (err) {
      auditLog("game_create_error", { ip, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const parsed = GameUpdateSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { gameId, seasonLeagueId, opponent, location, teamScore, opponentScore, result, playedOn, notes, boxScore } = parsed.data;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.game.update({
          where: { id: gameId },
          data: { opponent, location, teamScore, opponentScore, result, playedOn: new Date(playedOn), notes: notes ?? null },
        });
        await tx.playerGameStat.deleteMany({ where: { gameId } });
        if (boxScore?.length) {
          await tx.playerGameStat.createMany({
            data: boxScore.map(r => ({
              playerId: r.playerId, gameId,
              minutes: r.minutes, pts: r.pts, reb: r.reb, ast: r.ast,
              stl: r.stl, blk: r.blk, to: r.tov, pf: r.pf,
              fgm: r.fgm, fga: r.fga, tpm: r.fg3m, tpa: r.fg3a,
              ftm: r.ftm, fta: r.fta, plusMinus: 0,
            })),
          });
        }
        await recalcAggregates(seasonLeagueId, tx);
      });
      auditLog("game_updated", { ip, gameId, opponent });
      return res.status(200).json({ ok: true });
    } catch (err) {
      auditLog("game_update_error", { ip, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const parsed = GameDeleteSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const { gameId, seasonLeagueId } = parsed.data;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.game.delete({ where: { id: gameId } });
        await recalcAggregates(seasonLeagueId, tx);
      });
      auditLog("game_deleted", { ip, gameId });
      return res.status(200).json({ ok: true });
    } catch (err) {
      auditLog("game_delete_error", { ip, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);
