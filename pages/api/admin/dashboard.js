/**
 * pages/api/admin/dashboard.js
 * GET /api/admin/dashboard
 *
 * Returns only what the dashboard needs -- aggregates + last 5 games.
 * Fast: no full box score data, no player details, no season breakdown.
 */

import { requireAuth } from "../../../lib/requireAuth";
import { prisma }      from "../../../lib/prisma";

async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    const [games, players, seasonLeagues, seasons] = await Promise.all([
      prisma.game.findMany({ orderBy: { playedOn: "desc" } }),
      prisma.player.findMany({ where: { isActive: true }, select: { id: true } }),
      prisma.seasonLeague.findMany({ include: { league: true, season: true } }),
      prisma.season.findMany({ orderBy: { year: "desc" }, take: 1 }),
    ]);

    const wins   = games.filter(g => g.result === "W").length;
    const losses = games.filter(g => g.result === "L").length;

    // Season avg stats -- lightweight: just pull pts/reb/ast totals
    const recentGameIds = games.slice(0, 20).map(g => g.id);
    let ppg = "--", rpg = "--", apg = "--";

    if (recentGameIds.length > 0) {
      const agg = await prisma.playerGameStat.aggregate({
        where:  { gameId: { in: recentGameIds } },
        _sum:   { pts: true, reb: true, ast: true },
      });
      const gp = recentGameIds.length;
      ppg = agg._sum.pts  ? (agg._sum.pts  / gp).toFixed(1) : "--";
      rpg = agg._sum.reb  ? (agg._sum.reb  / gp).toFixed(1) : "--";
      apg = agg._sum.ast  ? (agg._sum.ast  / gp).toFixed(1) : "--";
    }

    return res.status(200).json({
      currentSeason:     seasons[0]?.name ?? null,
      record:            { wins, losses },
      totalGames:        games.length,
      totalPlayers:      players.length,
      totalSeasonLeagues: seasonLeagues.length,
      ppg, rpg, apg,
      recentGames: games.slice(0, 5).map(g => ({
        id:           g.id,
        opponent:     g.opponent,
        result:       g.result,
        teamScore:    g.teamScore,
        opponentScore: g.opponentScore,
        playedOn:     g.playedOn?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    console.error("[dashboard]", err);
    return res.status(500).json({ error: err.message });
  }
}

export default requireAuth(handler);
