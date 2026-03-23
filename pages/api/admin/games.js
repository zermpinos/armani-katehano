/**
 * pages/api/admin/games.js
 * POST   /api/admin/games -> create game + box score + recalc aggregates
 * PUT    /api/admin/games -> edit game + box score + recalc aggregates
 * DELETE /api/admin/games -> delete game + recalc aggregates
 * GET    /api/admin/games -> list all games (lightweight, no box score)
 */

import { z }                         from "zod";
import { zCuid }                     from "../../../lib/validators.js";
import { requireAuth }               from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security.js";
import prisma                        from "../../../lib/prisma.js";
import { recalcAggregates }          from "../../../lib/stats.prisma.js";
import { prodError }                 from "../../../lib/utils.js";

const BoxScoreRowSchema = z.object({
  playerId:  zCuid,   // ← was z.string().cuid() -- removed in Zod v4
  minutes:   z.coerce.number().int().min(0).max(60),
  pts:       z.coerce.number().int().min(0).max(200),
  reb:       z.coerce.number().int().min(0).max(100),
  orb:       z.coerce.number().int().min(0).max(50).default(0),
  drb:       z.coerce.number().int().min(0).max(50).default(0),
  ast:       z.coerce.number().int().min(0).max(100),
  stl:       z.coerce.number().int().min(0).max(50),
  blk:       z.coerce.number().int().min(0).max(50),
  tov:       z.coerce.number().int().min(0).max(50),
  pf:        z.coerce.number().int().min(0).max(6),
  fgm:       z.coerce.number().int().min(0).max(100),
  fga:       z.coerce.number().int().min(0).max(100),
  fg2m:      z.coerce.number().int().min(0).max(100),
  fg2a:      z.coerce.number().int().min(0).max(100),
  fg3m:      z.coerce.number().int().min(0).max(50),
  fg3a:      z.coerce.number().int().min(0).max(50),
  ftm:       z.coerce.number().int().min(0).max(50),
  fta:       z.coerce.number().int().min(0).max(50),
})
  .refine(r => r.fgm  <= r.fga,               { message: "fgm cannot exceed fga" })
  .refine(r => r.fg2m <= r.fg2a,              { message: "fg2m cannot exceed fg2a" })
  .refine(r => r.fg3m <= r.fg3a,              { message: "fg3m cannot exceed fg3a" })
  .refine(r => r.ftm  <= r.fta,               { message: "ftm cannot exceed fta" })
  .refine(r => r.fg2m + r.fg3m === r.fgm,     { message: "fg2m + fg3m must equal fgm" })
  .refine(r => r.fg3m <= r.fgm,               { message: "fg3m cannot exceed fgm" })
  .refine(r => r.orb  + r.drb <= r.reb + 1,   { message: "orb+drb cannot exceed reb" });

const GameWriteSchema = z.object({
  seasonLeagueId: zCuid,   // ← was z.string().cuid() -- removed in Zod v4
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
  gameId: zCuid,   // ← was z.string().cuid() -- removed in Zod v4
});

const GameDeleteSchema = z.object({
  gameId:         zCuid,   // ← was z.string().cuid() -- removed in Zod v4
  seasonLeagueId: zCuid,   // ← was z.string().cuid() -- removed in Zod v4
});

/** Maps a validated box score row into the shape Prisma expects. */
function toDbRow(r, gameId = undefined) {
  return {
    ...(gameId ? { gameId } : {}),
    playerId:  r.playerId,
    minutes:   r.minutes,
    pts:       r.pts,
    reb:       r.reb,
    orb:       r.orb  ?? 0,
    drb:       r.drb  ?? 0,
    ast:       r.ast,
    stl:       r.stl,
    blk:       r.blk,
    tov:       r.tov,
    pf:        r.pf,
    fgm:       r.fgm,
    fga:       r.fga,
    fg2m:      r.fg2m,
    fg2a:      r.fg2a,
    fg3m:      r.fg3m,
    fg3a:      r.fg3a,
    ftm:       r.ftm,
    fta:       r.fta,
    plusMinus: 0,
  };
}

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── LIST ───────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const { seasonLeagueId } = req.query;

      let whereClause = {};
      if (seasonLeagueId) {
        whereClause = { seasonLeagueId };
      }

      const games = await prisma.game.findMany({
        where:   Object.keys(whereClause).length ? whereClause : undefined,
        orderBy: { playedOn: "desc" },
        take:    200,
        include: {
          playerStats: {
            include: { player: { select: { id: true, name: true, number: true } } },
          },
        },
      });

      return res.status(200).json({
        games: games.map(g => ({
          id:             g.id,
          seasonLeagueId: g.seasonLeagueId,
          opponent:       g.opponent,
          location:       g.location,
          teamScore:      g.teamScore,
          opponentScore:  g.opponentScore,
          result:         g.result,
          playedOn:       g.playedOn?.toISOString() ?? null,
          notes:          g.notes,
          boxScore: g.playerStats.map(s => ({
            playerId: s.playerId,
            pid:      s.playerId,
            min:      s.minutes,
            pts:      s.pts,
            reb:      s.reb,
            orb:      s.orb,
            drb:      s.drb,
            ast:      s.ast,
            stl:      s.stl,
            blk:      s.blk,
            tov:      s.tov,
            pf:       s.pf,
            fgm:      s.fgm,
            fga:      s.fga,
            fg2m:     s.fg2m,
            fg2a:     s.fg2a,
            fg3m:     s.fg3m,
            fg3a:     s.fg3a,
            ftm:      s.ftm,
            fta:      s.fta,
            eff:      s.pts + s.reb + s.ast + s.stl + s.blk - (s.fga - s.fgm) - (s.fta - s.ftm) - s.tov,
          })),
        })),
      });
    } catch (err) {
      return res.status(500).json({ error: prodError(err) });
    }
  }

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
            data: boxScore.map(r => toDbRow(r, g.id)),
          });
        }
        await recalcAggregates(seasonLeagueId, tx);
        return g;
      });
      auditLog("game_created", { ip, gameId: game.id, opponent });
      return res.status(201).json({ ok: true, gameId: game.id });
    } catch (err) {
      auditLog("game_create_error", { ip, error: err.message });
      return res.status(500).json({ error: prodError(err) });
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
          data:  { opponent, location, teamScore, opponentScore, result, playedOn: new Date(playedOn), notes: notes ?? null },
        });
        await tx.playerGameStat.deleteMany({ where: { gameId } });
        if (boxScore?.length) {
          await tx.playerGameStat.createMany({
            data: boxScore.map(r => toDbRow(r, gameId)),
          });
        }
        await recalcAggregates(seasonLeagueId, tx);
      });
      auditLog("game_updated", { ip, gameId, opponent });
      return res.status(200).json({ ok: true });
    } catch (err) {
      auditLog("game_update_error", { ip, error: err.message });
      return res.status(500).json({ error: prodError(err) });
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
      return res.status(500).json({ error: prodError(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

export default requireAuth(handler);