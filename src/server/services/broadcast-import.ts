import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { verify } from "@/server/utils/broadcast-token";
import { auditLog } from "@/server/security/node/audit-log";
import { sendGameImportedBroadcast } from "@/server/integrations/email/client";
import type { GameImportedGame, TopPerformer } from "@/server/integrations/email/templates";

export type VerifyAndPreviewResult =
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "not_found" | "not_imported" | "no_imported_game" }
  | { ok: true;  state: "already_broadcast"; broadcastedAt: Date; game: GameImportedGame }
  | { ok: true;  state: "confirmable";       game: GameImportedGame; topPerformers: TopPerformer[]; recipientCount: number };

function toGameImported(g: {
  id: string; opponent: string; location: string | null; teamScore: number;
  opponentScore: number; result: string; playedOn: Date; notes: string | null;
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
  };
}

export async function verifyAndPreview(token: string): Promise<VerifyAndPreviewResult> {
  const v = verify(token);
  if (!v.ok) return { ok: false, reason: v.reason };

  const job = await prisma.gameImportJob.findUnique({
    where:  { id: v.jobId },
    include: { importedGame: true },
  });
  if (!job) return { ok: false, reason: "not_found" };
  if (job.state !== "IMPORTED") return { ok: false, reason: "not_imported" };
  if (!job.importedGame || !job.importedGameId) return { ok: false, reason: "no_imported_game" };

  const game = toGameImported(job.importedGame);

  if (job.subscriberBroadcastAt) {
    return { ok: true, state: "already_broadcast", broadcastedAt: job.subscriberBroadcastAt, game };
  }

  const [recipientCount, stats] = await Promise.all([
    prisma.subscriber.count({ where: { confirmedAt: { not: null } } }),
    prisma.playerGameStat.findMany({
      where:   { gameId: job.importedGameId },
      orderBy: [{ pts: "desc" }, { reb: "desc" }, { ast: "desc" }],
      take:    3,
      include: { player: { select: { name: true, number: true } } },
    }),
  ]);

  const topPerformers: TopPerformer[] = stats.map(s => ({
    number: s.player.number,
    name:   s.player.name,
    pts:    s.pts,
    reb:    s.reb,
    ast:    s.ast,
  }));

  auditLog("broadcast_link_viewed", { jobId: job.id });
  return { ok: true, state: "confirmable", game, topPerformers, recipientCount };
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
    where:  { id: v.jobId },
    include: { importedGame: true },
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

  const [subscribers, stats] = await Promise.all([
    prisma.subscriber.findMany({ where: { confirmedAt: { not: null } }, select: { id: true, email: true, token: true } }),
    prisma.playerGameStat.findMany({
      where:   { gameId: job.importedGameId },
      orderBy: [{ pts: "desc" }, { reb: "desc" }, { ast: "desc" }],
      take:    3,
      include: { player: { select: { name: true, number: true } } },
    }),
  ]);

  const game = toGameImported(job.importedGame);
  const topPerformers: TopPerformer[] = stats.map(s => ({
    number: s.player.number, name: s.player.name, pts: s.pts, reb: s.reb, ast: s.ast,
  }));

  await sendGameImportedBroadcast({ game, topPerformers, subscribers });

  return { ok: true, state: "broadcasted", recipientCount: subscribers.length };
}
