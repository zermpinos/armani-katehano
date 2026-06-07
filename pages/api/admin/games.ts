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
import { invalidateForGameMutation } from "@/server/services/cache-invalidation";
import { MAX_GAMES_PER_PAGE } from "@/domain/shared/constants";
import { calcEff } from "@/domain/stats";
import { handleError } from "@/server/http/handle-error";
import { parseBody } from "@/server/http/parse-body";
import { methodRouter } from "@/server/http/method-router";

async function slugsForPlayerIds(playerIds: readonly string[]): Promise<string[]> {
  if (!playerIds.length) return [];
  const rows = await prisma.player.findMany({
    where:  { id: { in: [...new Set(playerIds)] } },
    select: { slug: true },
  });
  return rows.map(r => r.slug);
}

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
    try {
      await recalcAggregates(seasonLeagueId);
    } catch (err) {
      console.error("[games/create] recalcAggregates failed after commit:", err);
    }
    auditLog("game_created", { ip, gameId: game.id, opponent });
    await invalidateForGameMutation({
      revalidate: (p) => res.revalidate?.(p),
      gameId: game.id,
      affectedPlayerSlugs: await slugsForPlayerIds(boxScore?.map(r => r.playerId) ?? []),
    });
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

  let existingSeasonLeagueId: string;
  let previousPlayerIds: string[] = [];
  let leagueChanged = false;

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.game.findUniqueOrThrow({
        where: { id: gameId },
        select: { seasonLeagueId: true },
      });
      existingSeasonLeagueId = existing.seasonLeagueId;
      leagueChanged =
        newLeagueId !== undefined && newLeagueId !== existing.seasonLeagueId;
      previousPlayerIds = (
        await tx.playerGameStat.findMany({ where: { gameId }, select: { playerId: true } })
      ).map(r => r.playerId);
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
    });
    try {
      // safe: assigned inside tx callback; if tx throws, this block is unreachable
      await recalcAggregates(existingSeasonLeagueId!);
      if (leagueChanged) {
        await recalcAggregates(newLeagueId!);
      }
    } catch (err) {
      console.error("[games/update] recalcAggregates failed after commit:", err);
    }
    auditLog("game_updated", { ip, gameId, opponent });
    const newPlayerIds = boxScore?.map(r => r.playerId) ?? [];
    await invalidateForGameMutation({
      revalidate: (p) => res.revalidate?.(p),
      gameId,
      affectedPlayerSlugs: await slugsForPlayerIds([...previousPlayerIds, ...newPlayerIds]),
    });
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

  let deletedSeasonLeagueId: string;
  let deletedPlayerIds: string[] = [];

  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.game.findUniqueOrThrow({
        where: { id: gameId },
        select: { seasonLeagueId: true },
      });
      deletedSeasonLeagueId = existing.seasonLeagueId;
      deletedPlayerIds = (
        await tx.playerGameStat.findMany({ where: { gameId }, select: { playerId: true } })
      ).map(r => r.playerId);
      await tx.game.delete({ where: { id: gameId } });
    });
    try {
      // safe: assigned inside tx callback; if tx throws, this block is unreachable
      await recalcAggregates(deletedSeasonLeagueId!);
    } catch (err) {
      console.error("[games/delete] recalcAggregates failed after commit:", err);
    }
    auditLog("game_deleted", { ip, gameId });
    await invalidateForGameMutation({
      revalidate: (p) => res.revalidate?.(p),
      gameId,
      affectedPlayerSlugs: await slugsForPlayerIds(deletedPlayerIds),
    });
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
