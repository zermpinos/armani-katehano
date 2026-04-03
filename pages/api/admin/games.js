/**
 * pages/api/admin/games.js
 * POST   /api/admin/games → create game + box score + recalc aggregates
 * PUT    /api/admin/games → edit game + box score + recalc aggregates
 * DELETE /api/admin/games → delete game + recalc aggregates
 * GET    /api/admin/games → list all games (lightweight, no box score)
 */

import { z }                              from "zod";
import { BoxScoreRowSchema }              from "../../../lib/validators.js";
import { requireAuth }                    from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog }      from "../../../lib/security.js";
import prisma                             from "../../../lib/prisma.js";
import { recalcAggregates }               from "../../../lib/stats.prisma.js";
import { prodError, MAX_GAMES_PER_PAGE }  from "../../../lib/utils.js";
import { calcEff }                        from "../../../lib/stats.js";

const GameWriteSchema = z.object({
  seasonLeagueId: z.string().cuid(),
  opponent:       z.string().min(1).max(100),
  location:       z.enum(["home", "away"]).default("away"),
  teamScore:      z.coerce.number().int().min(0).max(300),
  opponentScore:  z.coerce.number().int().min(0).max(300),
  result:         z.enum(["W", "L"]),
  playedOn:       z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes:          z.string().max(1000).optional().nullable(),
  sourceUrl:      z.string().url().max(500).optional().nullable(),
  youtubeUrl:     z.string().url().max(500).optional().nullable(),
  boxScore:       z.array(BoxScoreRowSchema).max(20).optional(),
});

const GameUpdateSchema = GameWriteSchema.extend({
  gameId: z.string().cuid(),
});

const GameDeleteSchema = z.object({
  gameId:         z.string().cuid(),
  seasonLeagueId: z.string().cuid(),
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

      if (seasonLeagueId && !z.string().cuid().safeParse(seasonLeagueId).success) {
        return res.status(400).json({ error: "Invalid seasonLeagueId" });
      }

      const whereClause = seasonLeagueId ? { seasonLeagueId } : undefined;

      const games = await prisma.game.findMany({
        where:   whereClause,
        orderBy: { playedOn: "desc" },
        take:    MAX_GAMES_PER_PAGE,
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
            // Q-05: was inlined as s.pts + s.reb + ... — now uses shared calcEff()
            eff:      calcEff(s),
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
      return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") });
    }
    const { seasonLeagueId, opponent, location, teamScore, opponentScore, result, playedOn, notes, sourceUrl, youtubeUrl, boxScore } = parsed.data;

    try {
      const game = await prisma.$transaction(async (tx) => {
        const g = await tx.game.create({
          data: { seasonLeagueId, opponent, location, teamScore, opponentScore, result, playedOn: new Date(playedOn), notes: notes ?? null, sourceUrl: sourceUrl ?? null, youtubeUrl: youtubeUrl ?? null },
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
      return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") });
    }
    const { gameId, seasonLeagueId, opponent, location, teamScore, opponentScore, result, playedOn, notes, sourceUrl, youtubeUrl, boxScore } = parsed.data;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.game.update({
          where: { id: gameId },
          data:  { opponent, location, teamScore, opponentScore, result, playedOn: new Date(playedOn), notes: notes ?? null, sourceUrl: sourceUrl ?? null, youtubeUrl: youtubeUrl ?? null },
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
      return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") });
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