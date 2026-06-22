import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

export async function getUpcomingGames({ limit = 10 }: { limit?: number } = {}) {
  const rows = await prisma.upcomingGame.findMany({
    where:   { scheduledFor: { gte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    ...(limit ? { take: limit } : {}),
  });
  return rows.map(g => ({
    id:           g.id,
    opponent:     g.opponent,
    scheduledFor: g.scheduledFor.toISOString(),
    location:     g.location,
    round:        g.round,
    competition:  g.competition ?? null,
    notes:        g.notes ?? null,
  }));
}

export async function getUpcomingGamesWithAnnouncements() {
  const now = new Date();
  const rows = await prisma.upcomingGame.findMany({
    where:   { scheduledFor: { gte: now } },
    orderBy: { scheduledFor: "asc" },
    take:    10,
    include: {
      announcement: {
        include: {
          players: {
            include: { player: { select: { id: true, name: true, number: true, position: true, photoUrl: true, slug: true } } },
            orderBy: { player: { number: "asc" } },
          },
        },
      },
    },
  });
  return rows.map(g => ({
    id:           g.id,
    opponent:     g.opponent,
    scheduledFor: g.scheduledFor.toISOString(),
    location:     g.location,
    round:        g.round,
    competition:  g.competition ?? null,
    notes:        g.notes ?? null,
    announcement: g.announcement ? {
      message:     g.announcement.message ?? null,
      publishedAt: g.announcement.publishedAt.toISOString(),
      players:     g.announcement.players.map(sp => ({
        id:       sp.player.id,
        name:     sp.player.name,
        number:   sp.player.number,
        position: sp.player.position,
        photoUrl: sp.player.photoUrl ?? null,
        slug:     sp.player.slug,
        note:     sp.note ?? null,
      })),
    } : null,
  }));
}

export const getAllUpcomingGames = () => getUpcomingGames({ limit: 0 });

export async function getNextPlayoffGame() {
  const now = new Date();
  const game = await prisma.upcomingGame.findFirst({
    where: {
      scheduledFor: { gte: now },
      round: { in: ["quarterfinal", "semifinal", "final"] },
    },
    orderBy: { scheduledFor: "asc" },
  });
  if (!game) return null;
  return {
    opponent:     game.opponent,
    scheduledFor: game.scheduledFor.toISOString(),
    location:     game.location,
    round:        game.round,
    notes:        game.notes ?? null,
  };
}
