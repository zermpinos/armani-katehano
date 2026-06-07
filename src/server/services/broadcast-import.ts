import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { auditLog } from "@/server/security/node/audit-log";
import { sendGameImportedBroadcast } from "@/server/integrations/email/client";
import type {
  GameImportedGame,
  TopPerformer,
  GameEmailContext,
  TeamGameStats,
  SeasonRecord,
  NextGameInfo,
} from "@/server/integrations/email/templates";

function toGameImported(g: {
  id: string; opponent: string; location: string | null; teamScore: number;
  opponentScore: number; result: string; playedOn: Date; notes: string | null;
  seasonLeague: { league: { name: string } };
}): GameImportedGame {
  return {
    id:            g.id,
    opponent:      g.opponent,
    location:      g.location,
    teamScore:     g.teamScore,
    opponentScore: g.opponentScore,
    result:        g.result,
    playedOn:      g.playedOn,
    venueNote:     g.notes,
    competition:   g.seasonLeague.league.name,
  };
}

async function fetchTopPerformers(gameId: string): Promise<TopPerformer[]> {
  const stats = await prisma.playerGameStat.findMany({
    where:   { gameId },
    orderBy: [{ pts: "desc" }, { reb: "desc" }, { ast: "desc" }],
    take:    3,
    include: { player: { select: { name: true, number: true, position: true, photoUrl: true } } },
  });
  return stats.map(s => ({
    number:   s.player.number,
    name:     s.player.name,
    position: s.player.position,
    photoUrl: s.player.photoUrl ?? null,
    pts:      s.pts,
    reb:      s.reb,
    ast:      s.ast,
  }));
}

async function fetchTeamStats(gameId: string): Promise<TeamGameStats> {
  const agg = await prisma.playerGameStat.aggregate({
    where: { gameId },
    _sum:  { fgm: true, fga: true, reb: true, tov: true },
  });
  const fgmTotal = agg._sum.fgm ?? 0;
  const fgaTotal = agg._sum.fga ?? 0;
  return {
    fgPct:   fgaTotal > 0 ? Math.round((fgmTotal / fgaTotal) * 100) : null,
    teamReb: agg._sum.reb ?? 0,
    teamTov: agg._sum.tov ?? 0,
  };
}

async function fetchRecord(seasonLeagueId: string, playedOn: Date): Promise<SeasonRecord> {
  const groups = await prisma.game.groupBy({
    by:     ["result"],
    where:  { seasonLeagueId, playedOn: { lte: playedOn } },
    _count: { result: true },
  });
  let wins = 0;
  let losses = 0;
  for (const g of groups) {
    if (g.result === "W") wins = g._count.result;
    if (g.result === "L") losses = g._count.result;
  }
  return { wins, losses };
}

async function fetchNextGame(): Promise<NextGameInfo | null> {
  const ng = await prisma.upcomingGame.findFirst({
    where:   { scheduledFor: { gt: new Date() } },
    orderBy: { scheduledFor: "asc" },
    select:  { opponent: true, scheduledFor: true, location: true, notes: true },
  });
  if (!ng) return null;
  return {
    opponent:     ng.opponent,
    scheduledFor: ng.scheduledFor,
    location:     ng.location,
    venue:        ng.notes,
  };
}

export async function fetchBroadcastEnrichment(
  gameId:         string,
  seasonLeagueId: string,
  playedOn:       Date,
): Promise<{ topPerformers: TopPerformer[]; ctx: GameEmailContext }> {
  const topPerformers = await fetchTopPerformers(gameId);

  let ctx: GameEmailContext = { teamStats: null, record: null, nextGame: null };
  try {
    const [teamStats, record, nextGame] = await Promise.all([
      fetchTeamStats(gameId),
      fetchRecord(seasonLeagueId, playedOn),
      fetchNextGame(),
    ]);
    ctx = { teamStats, record, nextGame };
  } catch {
    // enrichment failed - broadcast continues without enriched sections
  }

  return { topPerformers, ctx };
}

function brevoConfigured(): boolean {
  return Boolean(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS);
}

export type ClaimReason = "not_found" | "transport_unavailable";

export type ClaimResult =
  | { ok: false; reason: ClaimReason }
  | { ok: true;  state: "already_broadcast"; broadcastedAt: Date }
  | { ok: true;  state: "broadcasted"; recipientCount: number };

export async function claimAndBroadcastByGameId(gameId: string): Promise<ClaimResult> {
  const game = await prisma.game.findUnique({
    where:   { id: gameId },
    include: { seasonLeague: { include: { league: { select: { name: true } } } } },
  });
  if (!game) return { ok: false, reason: "not_found" };

  if (game.broadcastedAt) {
    auditLog("broadcast_already_viewed", { gameId });
    return { ok: true, state: "already_broadcast", broadcastedAt: game.broadcastedAt };
  }

  if (!brevoConfigured()) {
    auditLog("broadcast_transport_unavailable", { gameId });
    return { ok: false, reason: "transport_unavailable" };
  }

  // Atomic claim: only the first caller to set broadcastedAt wins.
  const rowsAffected: number = await prisma.$executeRaw`
    UPDATE "Game"
    SET "broadcastedAt" = NOW()
    WHERE id = ${gameId} AND "broadcastedAt" IS NULL
  `;
  if (rowsAffected === 0) {
    const fresh = await prisma.game.findUnique({ where: { id: gameId }, select: { broadcastedAt: true } });
    auditLog("broadcast_already_claimed", { gameId });
    return { ok: true, state: "already_broadcast", broadcastedAt: fresh?.broadcastedAt ?? new Date() };
  }

  const [subscribers, { topPerformers, ctx }] = await Promise.all([
    prisma.subscriber.findMany({
      where:  { confirmedAt: { not: null } },
      select: { id: true, email: true, token: true },
    }),
    fetchBroadcastEnrichment(gameId, game.seasonLeagueId, game.playedOn),
  ]);

  const gameImported = toGameImported(game);
  await sendGameImportedBroadcast({ game: gameImported, topPerformers, ctx, subscribers });

  auditLog("broadcast_sent_by_game_id", { gameId, recipientCount: subscribers.length });
  return { ok: true, state: "broadcasted", recipientCount: subscribers.length };
}
