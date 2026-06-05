/**
 * Runs once before all E2E tests.
 * Skipped when PLAYWRIGHT_BASE_URL is set (CI against a Vercel preview).
 */
export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_BASE_URL) return;

  const { default: prisma } = await import("../src/server/db/client.ts");

  await prisma.loginAttempt.deleteMany({});

  const opponent = "E2E Roster Opponent";
  const future   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.gameRosterPlayer.deleteMany({
    where: { announcement: { upcomingGame: { opponent } } },
  });
  await prisma.gameRosterAnnouncement.deleteMany({
    where: { upcomingGame: { opponent } },
  });
  await prisma.upcomingGame.deleteMany({ where: { opponent } });

  const players = await prisma.player.findMany({
    where: { isActive: true },
    take: 5,
    orderBy: { number: "asc" },
    select: { id: true },
  });
  if (players.length < 1) {
    await prisma.$disconnect();
    return;
  }

  const game = await prisma.upcomingGame.create({
    data: {
      opponent,
      scheduledFor: future,
      location:     "home",
      competition:  "E2E Cup",
      notes:        null,
    },
  });

  await prisma.gameRosterAnnouncement.create({
    data: {
      upcomingGameId: game.id,
      message:        "Stay locked in defense.",
      publishedAt:    new Date(),
      players: {
        create: players.map((p, i) => ({
          playerId: p.id,
          note:     i < Math.min(3, players.length) ? "starter" : null,
        })),
      },
    },
  });

  await prisma.$disconnect();
}
