/**
 * pages/api/admin/import.js
 * POST /api/admin/import
 *
 * Body: { data: <scraper output> }
 * Protected by session cookie via requireAuth().
 *
 * Scraper output shape:
 * {
 *   url: string,
 *   game: {
 *     homeTeam, awayTeam, date, time, venue,
 *     finalScore: { home, away },
 *     quarterScores: [...]
 *   },
 *   teams: [
 *     {
 *       name: string,
 *       players: [
 *         { "#": number, Players: string, ST: string, MIN: string,
 *           PTS, FT: {made,attempted}, "2PTS": {made,attempted},
 *           "3PTS": {made,attempted}, FG: {made,attempted},
 *           OREB, DREB, REB, AST, STL, BLK, TO, PF, FO, EF }
 *       ]
 *     }
 *   ]
 * }
 */

import prisma               from "../../../lib/prisma.js";
import { recalcAggregates } from "../../../lib/stats.prisma.js";
import { prodError }        from "../../../lib/utils.js";
import { requireAuth }      from "../../../lib/requireAuth.js";

export default requireAuth(async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ── Validate shape ────────────────────────────────────────────────────────
  const { data } = req.body ?? {};

  if (!data?.game || !Array.isArray(data?.teams))
    return res.status(400).json({ error: "Missing game or teams in payload" });

  const { game, teams, url: sourceUrl } = data;

  if (!game.finalScore || !game.homeTeam || !game.awayTeam)
    return res.status(400).json({ error: "Missing finalScore, homeTeam or awayTeam" });

  // ── Find ARMANI team ──────────────────────────────────────────────────────
  const akTeam = teams.find(t =>
    t.name.toUpperCase().includes("ARMANI") ||
    t.name.toUpperCase().includes("KATEHANO")
  );
  if (!akTeam) return res.status(400).json({ error: "ARMANI KATEHANO team not found in teams array" });

  const isHome      = game.homeTeam.toUpperCase().includes("ARMANI") ||
                      game.homeTeam.toUpperCase().includes("KATEHANO");
  const akScore     = isHome ? game.finalScore.home : game.finalScore.away;
  const oppScore    = isHome ? game.finalScore.away : game.finalScore.home;
  const oppTeamName = isHome ? game.awayTeam : game.homeTeam;
  const result      = akScore > oppScore ? "W" : "L";

  // ── Parse date ────────────────────────────────────────────────────────────
  // game.date is Greek format: "Κυριακή, 14 Σεπτεμβρίου 2025"
  const GREEK_MONTHS = {
    "Ιανουαρίου": "01", "Φεβρουαρίου": "02", "Μαρτίου": "03",
    "Απριλίου":   "04", "Μαΐου":       "05", "Ιουνίου": "06",
    "Ιουλίου":    "07", "Αυγούστου":   "08", "Σεπτεμβρίου": "09",
    "Οκτωβρίου":  "10", "Νοεμβρίου":   "11", "Δεκεμβρίου":  "12",
  };

  let playedOn = null;
  const dateMatch = (game.date || "").match(/(\d{1,2})\s+(\S+)\s+(\d{4})/);
  if (dateMatch) {
    const day   = dateMatch[1].padStart(2, "0");
    const month = GREEK_MONTHS[dateMatch[2]] || "01";
    const year  = dateMatch[3];
    playedOn = new Date(`${year}-${month}-${day}`);
  } else {
    playedOn = new Date();
  }

  // ── Detect league from URL ────────────────────────────────────────────────
  const u = (sourceUrl || "").toLowerCase();
  let leagueSlug = "";
  if (u.includes("winter-cup"))       leagueSlug = "wintercup";
  else if (u.includes("rookie"))      leagueSlug = "rookie";
  else if (u.includes("bc6"))         leagueSlug = "bc6";
  else if (u.includes("/men/"))       leagueSlug = ""; // regular season — fallback below

  // ── Resolve seasonLeagueId ────────────────────────────────────────────────
  let seasonLeagueId = null;
  if (leagueSlug) {
    const league = await prisma.league.findFirst({ where: { slug: leagueSlug } });
    if (league) {
      const sl = await prisma.seasonLeague.findFirst({
        where:   { leagueId: league.id },
        orderBy: { createdAt: "desc" },
      });
      if (sl) seasonLeagueId = sl.id;
    }
  }
  if (!seasonLeagueId) {
    const sl = await prisma.seasonLeague.findFirst({ orderBy: { createdAt: "desc" } });
    if (!sl) return res.status(422).json({ error: "No SeasonLeague found — create one first" });
    seasonLeagueId = sl.id;
  }

  // ── Resolve player IDs by jersey number ──────────────────────────────────
  const allPlayers = await prisma.player.findMany({ where: { isActive: true } });
  const playerMap  = {};
  allPlayers.forEach(p => { playerMap[p.number] = p.id; });

  // ── Parse minutes (rounds to nearest minute) ──────────────────────────────
  const parseMinutes = (minStr) => {
    const m = (minStr || "").match(/^(\d+):(\d{2})$/);
    if (!m) return 0;
    const mins = parseInt(m[1], 10);
    const secs = parseInt(m[2], 10);
    return secs >= 30 ? mins + 1 : mins;
  };

  // ── Build box score rows ──────────────────────────────────────────────────
  const skipped  = [];
  const boxScore = akTeam.players
    .filter(p => parseMinutes(p.MIN) > 0)
    .map(p => {
      const playerId = playerMap[p["#"]];
      if (!playerId) {
        skipped.push(`#${p["#"]} ${p.Players}`);
        return null;
      }

      const fg2m = p["2PTS"]?.made      ?? 0;
      const fg2a = p["2PTS"]?.attempted ?? 0;
      const fg3m = p["3PTS"]?.made      ?? 0;
      const fg3a = p["3PTS"]?.attempted ?? 0;

      return {
        playerId,
        minutes:   parseMinutes(p.MIN),
        pts:       p.PTS  ?? 0,
        reb:       p.REB  ?? 0,
        orb:       p.OREB ?? 0,
        drb:       p.DREB ?? 0,
        ast:       p.AST  ?? 0,
        stl:       p.STL  ?? 0,
        blk:       p.BLK  ?? 0,
        tov:       p.TO   ?? 0,
        pf:        p.PF   ?? 0,
        fg2m, fg2a, fg3m, fg3a,
        fgm:       fg2m + fg3m,
        fga:       fg2a + fg3a,
        ftm:       p.FT?.made      ?? 0,
        fta:       p.FT?.attempted ?? 0,
        plusMinus: 0,
      };
    })
    .filter(Boolean);

  // ── Write to DB ───────────────────────────────────────────────────────────
  try {
    let gameId;

    await prisma.$transaction(async (tx) => {
      if (sourceUrl) {
        const duplicate = await tx.game.findUnique({ where: { sourceUrl } });
        if (duplicate) {
          throw Object.assign(new Error("DUPLICATE"), { gameId: duplicate.id });
        }
      }

      const g = await tx.game.create({
        data: {
          seasonLeagueId,
          opponent:      oppTeamName,
          location:      isHome ? "home" : "away",
          teamScore:     akScore,
          opponentScore: oppScore,
          result,
          playedOn,
          sourceUrl:     sourceUrl ?? null,
        },
      });
      gameId = g.id;

      if (boxScore.length) {
        await tx.playerGameStat.createMany({
          data: boxScore.map(row => ({ ...row, gameId: g.id })),
        });
      }

      await recalcAggregates(seasonLeagueId, tx);
    });

    return res.status(200).json({
      ok:              true,
      gameId,
      playersImported: boxScore.length,
      skipped,
    });

  } catch (err) {
    if (err.message === "DUPLICATE") {
      return res.status(409).json({
        ok:     false,
        error:  "This game has already been imported.",
        gameId: err.gameId,
      });
    }
    console.error("[import]", err);
    return res.status(500).json({ error: prodError(err) });
  }
});
