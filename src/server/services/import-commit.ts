import "@/server/_internal/node-only";
import type { z } from "zod";
import prisma from "@/server/db/client";
import type { GameWriteSchema } from "@/schemas/game";
import { verify } from "@/domain/import/verify";
import type { GateFailure } from "@/domain/import/verify";
import { recalcAggregates } from "@/server/services/stats-recalc";
import { invalidateForGameMutation } from "@/server/services/cache-invalidation";
import { sendImportNotification } from "@/server/integrations/email/client";
import { auditLog } from "@/server/security/node";

const SOURCE_KIND = "sportstats-html";

// Overwrites only while the capture is uncommitted. Once commitImport stamps a
// gameId the row is frozen, so a later re-scrape cannot replace the bytes that
// produced the saved game. Never throws: losing a capture must not block an import.
export async function captureImportDraft(
  sourceUrl: string,
  rawPayload: unknown,
  bytesHash: string,
): Promise<void> {
  try {
    const { count } = await prisma.importDraft.updateMany({
      where: { sourceUrl, gameId: null },
      data:  { rawPayload: rawPayload as object, bytesHash, sourceKind: SOURCE_KIND },
    });
    if (count === 0) {
      await prisma.importDraft.create({
        data: { sourceUrl, rawPayload: rawPayload as object, bytesHash, sourceKind: SOURCE_KIND },
      });
    }
  } catch (err) {
    // P2002 means the row exists and was not updatable, so it is already frozen.
    if ((err as { code?: string }).code !== "P2002")
      console.error("[import-commit] failed to capture raw payload:", err);
  }
}

// Re-derived from the stored bytes rather than trusted from the request: the
// gate the browser ran round-trips through a client that can edit or omit it.
// Reads only the uncommitted capture, so a URL with no live capture gates as
// clean, the same as a manually entered game.
async function gateCapturedScrape(sourceUrl: string): Promise<GateFailure[]> {
  const draft = await prisma.importDraft.findFirst({
    where:  { sourceUrl, gameId: null },
    select: { rawPayload: true },
  });
  if (!draft?.rawPayload) return [];
  return verify(draft.rawPayload as Record<string, unknown>).failures;
}

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
    result, playedOn, notes, sourceUrl, youtubeUrl, round, boxScore, importDiff,
  } = data;

  const rows = boxScore ?? [];
  const boxSum = rows.reduce((acc, r) => acc + (r.pts ?? 0), 0);
  if (rows.length && boxSum !== teamScore)
    throw new CommitError(
      `Box score points (${boxSum}) do not match teamScore (${teamScore}). Diff: ${boxSum - teamScore}`,
      422,
    );

  // Only absent data blocks. A column the source stopped emitting arrives as a
  // plausible zero and an empty box score renders as a roster of zeros, and
  // neither can be fixed at the editable cell the way a wrong number can. Every
  // other failure reaches the operator next to the field that corrects it.
  const gateFailures = sourceUrl ? await gateCapturedScrape(sourceUrl) : [];
  const blocking = gateFailures.filter(f => f.check === "columns" || f.check === "empty");
  if (blocking.length)
    throw new CommitError(
      `Source data failed verification. ${blocking.map(f => f.detail).join(" ")}`,
      422,
    );

  // A box score cannot say whether a game was a playoff; the fixture the admin
  // scheduled can. GameWriteSchema defaults round to "regular", so by here an
  // unset round is indistinguishable from an explicit one. No import caller
  // sets round at all, which is what makes deferring to the fixture safe.
  const scheduled = sourceUrl
    ? await prisma.upcomingGame.findFirst({ where: { sourceUrl }, select: { round: true } })
    : null;
  const effectiveRound = round === "regular" && scheduled?.round ? scheduled.round : round;

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
        round:      effectiveRound,
      },
    });

    if (rows.length) {
      await tx.playerGameStat.createMany({
        data: rows.map(r => ({ ...r, gameId: g.id, plusMinus: 0 })),
      });
    }

    if (sourceUrl) {
      await tx.importDraft.updateMany({
        where: { sourceUrl, gameId: null },
        data:  { gameId: g.id },
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
    ...(gateFailures.length ? { gateFailures } : {}),
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
