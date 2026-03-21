/**
 * pages/api/admin/import.js
 * POST /api/admin/import
 *
 * Called by your LOCAL scrape.js script -- not by the browser.
 * Accepts pre-scraped game JSON + a shared secret, saves directly to DB.
 *
 * The browser import page (/admin/[slug]/import) uses /api/admin/games
 * as always. This endpoint is the "headless" path for the CLI script.
 *
 * Body: { secret: string, data: { match_info, armani_katehano } }
 *
 * Env vars required:
 *   IMPORT_SECRET  -- shared secret between this endpoint and your local script
 *   (All existing DB env vars used by your Prisma client)
 */

import prisma                from "../../../lib/prisma.js";
import { recalcAggregates } from "../../../lib/stats.prisma.js";

const ALLOWED_METHODS = ["POST"];

export default async function handler(req, res) {
  if (!ALLOWED_METHODS.includes(req.method))
    return res.status(405).json({ error: "Method not allowed" });

  // ── Auth: shared secret ───────────────────────────────────────────────────
  const { secret, data } = req.body ?? {};

  const expected = process.env.IMPORT_SECRET;
  if (!expected) return res.status(500).json({ error: "IMPORT_SECRET not configured" });

  // Constant-time comparison to prevent timing attacks
  let secretOk = false;
  try {
    const crypto = await import("crypto");
    const a = Buffer.from(secret || "");
    const b = Buffer.from(expected);
    if (a.length === b.length) secretOk = crypto.timingSafeEqual(a, b);
  } catch { secretOk = secret === expected; }

  if (!secretOk) return res.status(401).json({ error: "Unauthorized" });

  // ── Validate payload ──────────────────────────────────────────────────────
  if (!data?.match_info || !data?.armani_katehano?.players)
    return res.status(400).json({ error: "Missing match_info or players" });

  const mi      = data.match_info;
  const players = data.armani_katehano.players;

  if (!mi.date || !mi.opponent)
    return res.status(400).json({ error: "match_info missing date or opponent" });

  // ── Resolve seasonLeagueId from league slug ───────────────────────────────
  let seasonLeagueId = null;
  if (mi.league) {
    const league = await prisma.league.findFirst({ where: { slug: mi.league } });
    if (league) {
      // Find the most recent active SeasonLeague for this league
      const sl = await prisma.seasonLeague.findFirst({
        where:   { leagueId: league.id },
        orderBy: { createdAt: "desc" },
      });
      if (sl) seasonLeagueId = sl.id;
    }
  }

  if (!seasonLeagueId) {
    // Fallback: use the most recently created SeasonLeague
    const sl = await prisma.seasonLeague.findFirst({ orderBy: { createdAt: "desc" } });
    if (!sl) return res.status(422).json({ error: "No SeasonLeague found -- create one first in the admin panel" });
    seasonLeagueId = sl.id;
  }

  // ── Resolve player IDs by jersey number ───────────────────────────────────
  const allPlayers = await prisma.player.findMany({ where: { isActive: true } });

  const playerMap = {}; // jersey number -> player.id
  allPlayers.forEach(p => { playerMap[p.number] = p.id; });

  // ── Build boxScore rows ────────────────────────────────────────────────────
  const boxScore = players
    .filter(p => !p.did_not_play)
    .map(p => {
      const playerId = playerMap[p.jersey_number];
      if (!playerId) return null; // player not in DB -- skip, don't crash

      const fg2m = p.two_point_fg?.made      ?? 0;
      const fg2a = p.two_point_fg?.attempted ?? 0;
      const fg3m = p.three_point_fg?.made      ?? 0;
      const fg3a = p.three_point_fg?.attempted ?? 0;

      return {
        playerId,
        minutes:   p.minutes_played?.total_seconds ? Math.round(p.minutes_played.total_seconds / 60) : 0,
        pts:  p.points,
        reb:  p.total_rebounds,
        orb:  p.offensive_rebounds ?? 0,
        drb:  p.defensive_rebounds ?? 0,
        ast:  p.assists,
        stl:  p.steals,
        blk:  p.blocks,
        tov:  p.turnovers,
        pf:   p.fouls_committed ?? 0,
        fg2m: p.two_point_fg?.made      ?? 0,
        fg2a: p.two_point_fg?.attempted ?? 0,
        fg3m: p.three_point_fg?.made      ?? 0,
        fg3a: p.three_point_fg?.attempted ?? 0,
        fgm:  (p.two_point_fg?.made ?? 0) + (p.three_point_fg?.made ?? 0),
        fga:  (p.two_point_fg?.attempted ?? 0) + (p.three_point_fg?.attempted ?? 0),
        ftm:  p.free_throws?.made      ?? 0,
        fta:  p.free_throws?.attempted ?? 0,
        plusMinus: 0,
      };
    })
    .filter(Boolean);

  const skipped = players.filter(p => !p.did_not_play && !playerMap[p.jersey_number]);

  // ── Write to DB (same pattern as your existing /api/admin/games POST) ─────
  try {
    const gameId = cuid();

    await prisma.$transaction([
      prisma.game.create({
        data: {
          id:            gameId,
          seasonLeagueId,
          opponent:      mi.opponent,
          location:      mi.home_team?.toUpperCase().includes("ARMANI") ? "home" : "away",
          teamScore:     mi.armani_katehano_score ?? 0,
          opponentScore: mi.opponent_score ?? 0,
          result:        mi.result,
          playedOn:      new Date(mi.date),
        },
      }),
      ...boxScore.map(row =>
        prisma.playerGameStat.create({
          data: { id: cuid(), gameId, ...row },
        })
      ),
    ]);

    return res.status(200).json({
      ok: true,
      gameId,
      playersImported: boxScore.length,
      skipped: skipped.map(p => `#${p.jersey_number} ${p.name_greek}`),
      warnings: data._warnings ?? [],
    });

  } catch (err) {
    console.error("[import]", err);
    return res.status(500).json({ error: err.message });
  }
}
