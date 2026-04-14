/**
 * pages/api/admin/import.js
 * POST /api/admin/import
 *
 * Accepts a scraper payload, resolves player IDs, writes the game +
 * box score to DB inside a transaction, then recomputes aggregates.
 * Protected by admin session cookie via requireAuth().
 */

import prisma                    from "../../../lib/prisma";
import { recalcAggregates }     from '../../../lib/stats.prisma';
import { prodError }            from "../../../lib/utils";
import { requireAuth }          from '../../../lib/requireAuth';
import { BoxScoreRowSchema }    from "../../../lib/validators";
import {
  parseGreekDate,
  detectLeagueSlug,
  parseMinutes,
} from '../../../lib/greekDate';

// Single source of truth for team name matching
const AK_IDENTIFIERS = ["ARMANI", "KATEHANO"];

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ── Validate top-level shape ───────────────────────────────────────────────
  const { data } = req.body ?? {};

  if (!data?.game || !Array.isArray(data?.teams))
    return res.status(400).json({ error: "Missing game or teams in payload" });

  const { game, teams, url: sourceUrl } = data;

  if (!game.finalScore || !game.homeTeam || !game.awayTeam)
    return res.status(400).json({ error: "Missing finalScore, homeTeam or awayTeam" });

  // ── Find ARMANI team ───────────────────────────────────────────────────────
  const akTeam = teams.find((t: any) =>
    AK_IDENTIFIERS.some(id => t.name.toUpperCase().includes(id))
  );
  if (!akTeam) {
    const found = teams.map((t: any) => `"${t.name}"`).join(", ");
    return res.status(400).json({
      error: `ARMANI KATEHANO team not found. Teams in payload: ${found}`,
    });
  }

  // ── Derive game metadata ───────────────────────────────────────────────────
  const isHome = AK_IDENTIFIERS.some(id =>
    game.homeTeam.toUpperCase().includes(id)
  );

  // Validate scores are real numbers before any arithmetic
  const akScore  = Number(isHome ? game.finalScore.home : game.finalScore.away);
  const oppScore = Number(isHome ? game.finalScore.away : game.finalScore.home);

  if (!Number.isFinite(akScore) || !Number.isFinite(oppScore)) {
    return res.status(400).json({
      error: `Invalid finalScore values: home=${game.finalScore.home}, away=${game.finalScore.away}`,
    });
  }

  const oppTeamName = isHome ? game.awayTeam : game.homeTeam;
  const result      = akScore > oppScore ? "W" : "L";
  const playedOn    = parseGreekDate(game.date) as Date;       // ← from lib/greekDate.js

  const offRating   = Number.isFinite(Number(game.offRating)) ? Number(game.offRating) : null;
  const defRating   = Number.isFinite(Number(game.defRating)) ? Number(game.defRating) : null;

  // ── Resolve seasonLeagueId ────────────────────────────────────────────────
  const leagueSlug = detectLeagueSlug(sourceUrl);       // ← from lib/greekDate.js
  let seasonLeagueId: string | null = null;

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
    if (!sl) return res.status(422).json({ error: "No SeasonLeague found -- create one first" });
    seasonLeagueId = sl.id;
  }

  // ── Resolve player IDs by jersey number ───────────────────────────────────
  const allPlayers = await prisma.player.findMany({ where: { isActive: true } });
  const playerMap  = Object.fromEntries(allPlayers.map(p => [p.number, p.id]));

  // ── Build box score rows ──────────────────────────────────────────────────
  const skipped: string[] = [];
  const boxScore = akTeam.players
    .filter((p: any) => parseMinutes(p.MIN) > 0)              // ← from lib/greekDate.js
    .map((p: any) => {
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

  // ── Validate box score rows ───────────────────────────────────────────────
  const validationErrors: any[] = [];
  const validatedBoxScore = boxScore.map((row: any, i: number) => {
    const result = BoxScoreRowSchema.safeParse(row);
    if (!result.success) {
      validationErrors.push({ row: i, errors: result.error.flatten() });
      return null;
    }
    return result.data;
  }).filter(Boolean);

  if (validationErrors.length > 0) {
    return res.status(400).json({ error: "Invalid box score data", details: validationErrors });
  }

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
          offRating:     offRating ?? null,
          defRating:     defRating ?? null,
        },
      });
      gameId = g.id;

      if (validatedBoxScore.length) {
        await tx.playerGameStat.createMany({
          data: validatedBoxScore.map((row: any) => ({ ...row, gameId: g.id, plusMinus: 0 })),
        });
      }

      await recalcAggregates(seasonLeagueId!, tx);
    });

    // Revalidate all public ISR pages so they reflect the new game immediately
    // rather than waiting up to an hour for the next scheduled rebuild.
    const pagesToRevalidate = ["/", "/players", "/leaderboard", "/games", "/team-stats"];
    await Promise.allSettled(pagesToRevalidate.map(p => res.revalidate(p)));

    return res.status(200).json({
      ok:              true,
      gameId,
      playersImported: validatedBoxScore.length,
      skipped,
    });

  } catch (err) {
    if ((err as any).message === "DUPLICATE") {
      return res.status(409).json({
        ok:     false,
        error:  "This game has already been imported.",
        gameId: (err as any).gameId,
      });
    }
    console.error("[import]", err);
    return res.status(500).json({ error: prodError(err) });
  }
});