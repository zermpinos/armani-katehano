/**
 * pages/api/admin/games.js
 * POST   /api/admin/games         -> create game + box score + recalc aggregates
 * PUT    /api/admin/games         -> edit game + box score + recalc aggregates
 * DELETE /api/admin/games         -> delete game + recalc aggregates
 */

import { requireAuth }           from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security.js";
import prisma                    from "../../../lib/prisma.js";
import { recalcAggregates }      from "../../../lib/stats.prisma.js";

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── CREATE ────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { seasonLeagueId, opponent, location, teamScore, opponentScore, result, playedOn, notes, boxScore } = req.body ?? {};

    if (!seasonLeagueId || !opponent || !result || !playedOn) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const game = await prisma.game.create({
        data: {
          seasonLeagueId,
          opponent,
          location:      location ?? "away",
          teamScore:     Number(teamScore) || 0,
          opponentScore: Number(opponentScore) || 0,
          result,
          playedOn:      new Date(playedOn),
          notes:         notes ?? null,
        },
      });

      // Save box score rows
      if (boxScore?.length) {
        await prisma.playerGameStat.createMany({
          data: boxScore
            .filter(r => r.playerId)
            .map(r => ({
              playerId:  r.playerId,
              gameId:    game.id,
              minutes:   Number(r.minutes)   || 0,
              pts:       Number(r.pts)       || 0,
              reb:       Number(r.reb)       || 0,
              ast:       Number(r.ast)       || 0,
              stl:       Number(r.stl)       || 0,
              blk:       Number(r.blk)       || 0,
              to:        Number(r.tov)       || 0,
              pf:        Number(r.pf)        || 0,
              fgm:       Number(r.fgm)       || 0,
              fga:       Number(r.fga)       || 0,
              tpm:       Number(r.fg3m)      || 0,
              tpa:       Number(r.fg3a)      || 0,
              ftm:       Number(r.ftm)       || 0,
              fta:       Number(r.fta)       || 0,
              plusMinus: 0,
            })),
        });
      }

      await recalcAggregates(seasonLeagueId);
      auditLog("game_created", { ip, gameId: game.id, opponent });
      return res.status(201).json({ ok: true, gameId: game.id });
    } catch (err) {
      auditLog("game_create_error", { ip, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    const { gameId, seasonLeagueId, opponent, location, teamScore, opponentScore, result, playedOn, notes, boxScore } = req.body ?? {};

    if (!gameId) return res.status(400).json({ error: "Missing gameId" });

    try {
      await prisma.game.update({
        where: { id: gameId },
        data: {
          opponent,
          location:      location ?? "away",
          teamScore:     Number(teamScore) || 0,
          opponentScore: Number(opponentScore) || 0,
          result,
          playedOn:      new Date(playedOn),
          notes:         notes ?? null,
        },
      });

      // Replace all box score rows
      await prisma.playerGameStat.deleteMany({ where: { gameId } });

      if (boxScore?.length) {
        await prisma.playerGameStat.createMany({
          data: boxScore
            .filter(r => r.playerId)
            .map(r => ({
              playerId:  r.playerId,
              gameId,
              minutes:   Number(r.minutes)   || 0,
              pts:       Number(r.pts)       || 0,
              reb:       Number(r.reb)       || 0,
              ast:       Number(r.ast)       || 0,
              stl:       Number(r.stl)       || 0,
              blk:       Number(r.blk)       || 0,
              to:        Number(r.tov)       || 0,
              pf:        Number(r.pf)        || 0,
              fgm:       Number(r.fgm)       || 0,
              fga:       Number(r.fga)       || 0,
              tpm:       Number(r.fg3m)      || 0,
              tpa:       Number(r.fg3a)      || 0,
              ftm:       Number(r.ftm)       || 0,
              fta:       Number(r.fta)       || 0,
              plusMinus: 0,
            })),
        });
      }

      await recalcAggregates(seasonLeagueId);
      auditLog("game_updated", { ip, gameId, opponent });
      return res.status(200).json({ ok: true });
    } catch (err) {
      auditLog("game_update_error", { ip, error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { gameId, seasonLeagueId } = req.body ?? {};

    if (!gameId || !seasonLeagueId) {
      return res.status(400).json({ error: "Missing gameId or seasonLeagueId" });
    }

    try {
      // playerGameStats deleted automatically via cascade
      await prisma.game.delete({ where: { id: gameId } });
      await recalcAggregates(seasonLeagueId);
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
