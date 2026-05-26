import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { verify } from "@/server/utils/broadcast-token";
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

export type VerifyAndPreviewResult =
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "not_found" | "not_imported" | "no_imported_game" }
  | { ok: true;  state: "already_broadcast"; broadcastedAt: Date; game: GameImportedGame }
  | { ok: true;  state: "confirmable"; game: GameImportedGame; topPerformers: TopPerformer[]; ctx: GameEmailContext; recipientCount: number };

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
    where:  { seasonLeagueId, playedOn: { lt: playedOn } },
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
    // enrichment failed — broadcast continues without enriched sections
  }

  return { topPerformers, ctx };
}

export async function verifyAndPreview(token: string): Promise<VerifyAndPreviewResult> {
  const v = verify(token);
  if (!v.ok) return { ok: false, reason: v.reason };

  const job = await prisma.gameImportJob.findUnique({
    where:   { id: v.jobId },
    include: {
      importedGame: {
        include: { seasonLeague: { include: { league: { select: { name: true } } } } },
      },
    },
  });
  if (!job) return { ok: false, reason: "not_found" };
  if (job.state !== "IMPORTED") return { ok: false, reason: "not_imported" };
  if (!job.importedGame || !job.importedGameId) return { ok: false, reason: "no_imported_game" };

  const game = toGameImported(job.importedGame);

  if (job.subscriberBroadcastAt) {
    return { ok: true, state: "already_broadcast", broadcastedAt: job.subscriberBroadcastAt, game };
  }

  const [recipientCount, { topPerformers, ctx }] = await Promise.all([
    prisma.subscriber.count({ where: { confirmedAt: { not: null } } }),
    fetchBroadcastEnrichment(job.importedGameId, job.importedGame.seasonLeagueId, job.importedGame.playedOn),
  ]);

  auditLog("broadcast_link_viewed", { jobId: job.id });
  return { ok: true, state: "confirmable", game, topPerformers, ctx, recipientCount };
}

function brevoConfigured(): boolean {
  return Boolean(process.env.BREVO_SMTP_USER && process.env.BREVO_SMTP_PASS);
}

export type ClaimReason =
  | "malformed"
  | "bad_signature"
  | "expired"
  | "not_found"
  | "not_imported"
  | "no_imported_game"
  | "transport_unavailable";

export type ClaimResult =
  | { ok: false; reason: ClaimReason }
  | { ok: true;  state: "already_broadcast"; broadcastedAt: Date }
  | { ok: true;  state: "broadcasted"; recipientCount: number };

export async function claimAndBroadcast({ token, ip: _ip }: { token: string; ip: string }): Promise<ClaimResult> {
  const v = verify(token);
  if (!v.ok) {
    auditLog("broadcast_invalid_token", { reason: v.reason });
    return { ok: false, reason: v.reason };
  }

  const job = await prisma.gameImportJob.findUnique({
    where:   { id: v.jobId },
    include: {
      importedGame: {
        include: { seasonLeague: { include: { league: { select: { name: true } } } } },
      },
    },
  });
  if (!job)                                         return { ok: false, reason: "not_found" };
  if (job.state !== "IMPORTED")                     return { ok: false, reason: "not_imported" };
  if (!job.importedGame || !job.importedGameId)     return { ok: false, reason: "no_imported_game" };
  if (job.subscriberBroadcastAt) {
    auditLog("broadcast_already_viewed", { jobId: job.id });
    return { ok: true, state: "already_broadcast", broadcastedAt: job.subscriberBroadcastAt };
  }

  if (!brevoConfigured()) {
    auditLog("broadcast_transport_unavailable", { jobId: job.id });
    return { ok: false, reason: "transport_unavailable" };
  }

  const rowsAffected: number = await prisma.$executeRaw`
    UPDATE "GameImportJob"
    SET "subscriberBroadcastAt" = NOW()
    WHERE id = ${job.id} AND "subscriberBroadcastAt" IS NULL
  `;
  if (rowsAffected === 0) {
    const fresh = await prisma.gameImportJob.findUnique({ where: { id: job.id }, select: { subscriberBroadcastAt: true } });
    auditLog("broadcast_already_claimed", { jobId: job.id });
    return { ok: true, state: "already_broadcast", broadcastedAt: fresh?.subscriberBroadcastAt ?? new Date() };
  }

  const [subscribers, { topPerformers, ctx }] = await Promise.all([
    prisma.subscriber.findMany({ where: { confirmedAt: { not: null } }, select: { id: true, email: true, token: true } }),
    fetchBroadcastEnrichment(job.importedGameId, job.importedGame.seasonLeagueId, job.importedGame.playedOn),
  ]);

  const game = toGameImported(job.importedGame);

  await sendGameImportedBroadcast({ game, topPerformers, ctx, subscribers });

  return { ok: true, state: "broadcasted", recipientCount: subscribers.length };
}
