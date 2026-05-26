/**
 * pages/api/admin/games.js
 * POST   /api/admin/games -> create game + box score + recalc aggregates
 * PUT    /api/admin/games -> edit game + box score + recalc aggregates
 * DELETE /api/admin/games -> delete game + recalc aggregates
 * GET    /api/admin/games -> list all games (lightweight, no box score)
 */

import { z } from "zod";
import {
  GameWriteSchema,
  GameUpdateSchema,
  GameDeleteSchema,
} from "@/schemas/game";
import { requireAuth } from "@/server/auth";
import { auditLog, getClientIp } from "@/server/security/node";
import prisma from "@/server/db/client";
import { recalcAggregates } from "@/server/services/stats-recalc";
import { MAX_GAMES_PER_PAGE } from "@/domain/shared/constants";
import { calcEff } from "@/domain/stats";
import { handleError } from "@/server/http/handle-error";
import { parseBody } from "@/server/http/parse-body";
import { methodRouter } from "@/server/http/method-router";

const ISR_PATHS = ["/", "/players", "/leaderboard", "/games", "/team-stats"];

function toDbRow(r: any, gameId: string) {
  return {
    gameId,
    playerId: r.playerId,
    minutes: r.minutes,
    pts: r.pts,
    reb: r.reb,
    orb: r.orb ?? 0,
    drb: r.drb ?? 0,
    ast: r.ast,
    stl: r.stl,
    blk: r.blk,
    tov: r.tov,
    pf: r.pf,
    fgm: r.fgm,
    fga: r.fga,
    fg2m: r.fg2m,
    fg2a: r.fg2a,
    fg3m: r.fg3m,
    fg3a: r.fg3a,
    ftm: r.ftm,
    fta: r.fta,
    plusMinus: 0,
  };
}

async function listGames(req: any, res: any) {
  try {
    const { seasonLeagueId } = req.query;

    if (
      seasonLeagueId &&
      !z.string().cuid().safeParse(seasonLeagueId).success
    ) {
      return res.status(400).json({ error: "Invalid seasonLeagueId" });
    }

    const whereClause = seasonLeagueId ? { seasonLeagueId } : undefined;

    const games = await prisma.game.findMany({
      where: whereClause,
      orderBy: { playedOn: "desc" },
      take: MAX_GAMES_PER_PAGE,
      include: {
        playerStats: {
          include: {
            player: { select: { id: true, name: true, number: true } },
          },
        },
      },
    });

    return res.status(200).json({
      games: games.map((g) => ({
        id: g.id,
        seasonLeagueId: g.seasonLeagueId,
        opponent: g.opponent,
        location: g.location,
        teamScore: g.teamScore,
        opponentScore: g.opponentScore,
        result: g.result,
        playedOn: g.playedOn?.toISOString() ?? null,
        notes: g.notes,
        round: g.round,
        boxScore: g.playerStats.map((s) => ({
          playerId: s.playerId,
          minutes: s.minutes,
          pts: s.pts,
          reb: s.reb,
          orb: s.orb,
          drb: s.drb,
          ast: s.ast,
          stl: s.stl,
          blk: s.blk,
          tov: s.tov,
          pf: s.pf,
          fgm: s.fgm,
          fga: s.fga,
          fg2m: s.fg2m,
          fg2a: s.fg2a,
          fg3m: s.fg3m,
          fg3a: s.fg3a,
          ftm: s.ftm,
          fta: s.fta,
          eff: calcEff(s),
        })),
      })),
    });
  } catch (err) {
    return handleError(res, err);
  }
}

async function createGame(req: any, res: any) {
  const ip = getClientIp(req);
  const data = parseBody(GameWriteSchema, req.body, res);
  if (!data) return;
  const {
    seasonLeagueId,
    opponent,
    location,
    teamScore,
    opponentScore,
    result,
    playedOn,
    notes,
    sourceUrl,
    youtubeUrl,
    round,
    boxScore,
  } = data;

  if (boxScore?.length) {
    const boxSum = boxScore.reduce((acc, r) => acc + (r.pts ?? 0), 0);
    if (boxSum !== teamScore) {
      return res.status(422).json({
        error: `Box score points (${boxSum}) do not match teamScore (${teamScore}). Diff: ${boxSum - teamScore}`,
      });
    }
  }

  try {
    const game = await prisma.$transaction(async (tx) => {
      const g = await tx.game.create({
        data: {
          seasonLeagueId,
          opponent,
          location,
          teamScore,
          opponentScore,
          result,
          playedOn: new Date(playedOn),
          notes: notes ?? null,
          sourceUrl: sourceUrl ?? null,
          youtubeUrl: youtubeUrl ?? null,
          round,
        },
      });
      if (boxScore?.length) {
        await tx.playerGameStat.createMany({
          data: boxScore.map((r) => toDbRow(r, g.id)),
        });
      }
      await recalcAggregates(seasonLeagueId, tx);

      try {
        const gameDate = new Date(playedOn);
        const dayStart = new Date(gameDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(gameDate);
        dayEnd.setHours(23, 59, 59, 999);
        await tx.upcomingGame.deleteMany({
          where: {
            scheduledFor: { gte: dayStart, lte: dayEnd },
            opponent: { equals: opponent, mode: "insensitive" },
          },
        });
      } catch (err) {
        console.error("[games] failed to remove matching upcoming game:", err);
      }

      return g;
    });
    auditLog("game_created", { ip, gameId: game.id, opponent });
    await Promise.allSettled(ISR_PATHS.map((p) => res.revalidate?.(p)));
    return res.status(201).json({ ok: true, gameId: game.id });
  } catch (err) {
    auditLog("game_create_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

async function updateGame(req: any, res: any) {
  const ip = getClientIp(req);
  const data = parseBody(GameUpdateSchema, req.body, res);
  if (!data) return;
  const {
    gameId,
    opponent,
    location,
    teamScore,
    opponentScore,
    result,
    playedOn,
    notes,
    sourceUrl,
    youtubeUrl,
    round,
    boxScore,
    seasonLeagueId: newLeagueId,
  } = data;

  if (boxScore?.length) {
    const boxSum = boxScore.reduce((acc, r) => acc + (r.pts ?? 0), 0);
    if (boxSum !== teamScore) {
      return res.status(422).json({
        error: `Box score points (${boxSum}) do not match teamScore (${teamScore}). Diff: ${boxSum - teamScore}`,
      });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.game.findUniqueOrThrow({
        where: { id: gameId },
        select: { seasonLeagueId: true },
      });
      const leagueChanged =
        newLeagueId !== undefined && newLeagueId !== existing.seasonLeagueId;
      await tx.game.update({
        where: { id: gameId },
        data: {
          opponent,
          location,
          teamScore,
          opponentScore,
          result,
          playedOn: new Date(playedOn),
          notes: notes ?? null,
          sourceUrl: sourceUrl ?? null,
          youtubeUrl: youtubeUrl ?? null,
          round,
          ...(leagueChanged ? { seasonLeagueId: newLeagueId } : {}),
        },
      });
      await tx.playerGameStat.deleteMany({ where: { gameId } });
      if (boxScore?.length) {
        await tx.playerGameStat.createMany({
          data: boxScore.map((r) => toDbRow(r, gameId)),
        });
      }
      await recalcAggregates(existing.seasonLeagueId, tx);
      if (leagueChanged) {
        await recalcAggregates(newLeagueId!, tx);
      }
    });
    auditLog("game_updated", { ip, gameId, opponent });
    await Promise.allSettled(ISR_PATHS.map((p) => res.revalidate?.(p)));
    return res.status(200).json({ ok: true });
  } catch (err) {
    auditLog("game_update_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

async function deleteGame(req: any, res: any) {
  const ip = getClientIp(req);
  const data = parseBody(GameDeleteSchema, req.body, res);
  if (!data) return;
  const { gameId } = data;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.game.findUniqueOrThrow({
        where: { id: gameId },
        select: { seasonLeagueId: true },
      });
      await tx.game.delete({ where: { id: gameId } });
      await recalcAggregates(existing.seasonLeagueId, tx);
    });
    auditLog("game_deleted", { ip, gameId });
    await Promise.allSettled(ISR_PATHS.map((p) => res.revalidate?.(p)));
    return res.status(200).json({ ok: true });
  } catch (err) {
    auditLog("game_delete_error", { ip, error: (err as any).message });
    return handleError(res, err);
  }
}

export default requireAuth(
  methodRouter({
    GET: listGames,
    POST: createGame,
    PUT: updateGame,
    DELETE: deleteGame,
  }),
);
