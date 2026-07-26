import "@/server/_internal/node-only";
import type { z } from "zod";
import prisma from "@/server/db/client";
import type { GameWriteSchema } from "@/schemas/game";
import { recalcAggregates } from "@/server/services/stats-recalc";
import { invalidateForGameMutation } from "@/server/services/cache-invalidation";
import { sendImportNotification } from "@/server/integrations/email/client";
import { auditLog } from "@/server/security/node";

export class CommitError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly gameId?: string,
  ) {
    super(message);
    this.name = "CommitError";
  }
}

export type CommitInput = z.infer<typeof GameWriteSchema>;

export interface CommitOptions {
  ip?: string;
  revalidate?: (path: string) => Promise<void>;
}

export async function commitImport(data: CommitInput, opts: CommitOptions = {}): Promise<{ gameId: string }> {
  const {
    seasonLeagueId, opponent, location, teamScore, opponentScore,
    result, playedOn, notes, sourceUrl, youtubeUrl, round, boxScore, importDiff, gateFailures,
  } = data;

  const rows = boxScore ?? [];
  const boxSum = rows.reduce((acc, r) => acc + (r.pts ?? 0), 0);
  if (rows.length && boxSum !== teamScore)
    throw new CommitError(
      `Box score points (${boxSum}) do not match teamScore (${teamScore}). Diff: ${boxSum - teamScore}`,
      422,
    );

  const gameDate = new Date(playedOn);
  const affectedPlayerIds = [...new Set(rows.map(r => r.playerId))];

  const game = await prisma.$transaction(async (tx) => {
    if (sourceUrl) {
      const duplicate = await tx.game.findUnique({ where: { sourceUrl } });
      if (duplicate) throw new CommitError("This game has already been imported.", 409, duplicate.id);
    }

    const g = await tx.game.create({
      data: {
        seasonLeagueId,
        opponent,
        location,
        teamScore,
        opponentScore,
        result,
        playedOn: gameDate,
        notes:      notes      ?? null,
        sourceUrl:  sourceUrl  ?? null,
        youtubeUrl: youtubeUrl ?? null,
        round,
      },
    });

    if (rows.length) {
      await tx.playerGameStat.createMany({
        data: rows.map(r => ({ ...r, gameId: g.id, plusMinus: 0 })),
      });
    }

    try {
      const dayStart = new Date(gameDate); dayStart.setHours(0, 0, 0, 0);
      const dayEnd   = new Date(gameDate); dayEnd.setHours(23, 59, 59, 999);
      await tx.upcomingGame.deleteMany({
        where: {
          scheduledFor: { gte: dayStart, lte: dayEnd },
          opponent:     { equals: opponent, mode: "insensitive" },
        },
      });
    } catch (err) {
      console.error("[import-commit] failed to remove matching upcoming game:", err);
    }

    await recalcAggregates(seasonLeagueId, tx, affectedPlayerIds);

    return g;
  });

  auditLog("game_created", {
    ip: opts.ip,
    gameId: game.id,
    opponent,
    ...(importDiff?.length ? { importDiff } : {}),
    ...(gateFailures?.length ? { gateFailures } : {}),
  });

  const affectedPlayerSlugs = affectedPlayerIds.length
    ? (await prisma.player.findMany({
        where:  { id: { in: affectedPlayerIds } },
        select: { slug: true },
      })).map(p => p.slug)
    : [];

  await invalidateForGameMutation({
    revalidate: opts.revalidate,
    gameId: game.id,
    affectedPlayerSlugs,
  });

  // Admin ops alert, once per committed game. The subscriber recap stays a
  // separate, deliberate action from the game page.
  await sendImportNotification({
    kind:         "success",
    opponent,
    location,
    scheduledFor: gameDate.toISOString(),
    importedAt:   new Date(),
  }).catch(err => console.error("[import-commit] notify:", err));

  return { gameId: game.id };
}
