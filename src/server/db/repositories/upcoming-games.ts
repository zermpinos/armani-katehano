import "@/server/_internal/node-only";
import prisma from "@/server/db/client";

export async function getUpcomingGames() {
  const now = new Date();
  const rows = await prisma.upcomingGame.findMany({
    where: { scheduledFor: { gte: now } },
    orderBy: { scheduledFor: "asc" },
    take: 10,
  });
  return rows.map(g => ({
    id:           g.id,
    opponent:     g.opponent,
    scheduledFor: g.scheduledFor.toISOString(),
    location:     g.location,
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
            include: { player: { select: { id: true, name: true, number: true, position: true } } },
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
        note:     sp.note ?? null,
      })),
    } : null,
  }));
}

export async function getAllUpcomingGames() {
  const rows = await prisma.upcomingGame.findMany({
    orderBy: { scheduledFor: "asc" },
  });
  return rows.map(g => ({
    id:           g.id,
    opponent:     g.opponent,
    scheduledFor: g.scheduledFor.toISOString(),
    location:     g.location,
    competition:  g.competition ?? null,
    notes:        g.notes ?? null,
  }));
}
