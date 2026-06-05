/**
 * Runs once after all E2E tests.
 * Skipped when PLAYWRIGHT_BASE_URL is set (CI against a Vercel preview).
 */
export default async function globalTeardown() {
  if (process.env.PLAYWRIGHT_BASE_URL) return;

  const { default: prisma } = await import("../src/server/db/client.ts");

  const opponent = "E2E Roster Opponent";

  await prisma.gameRosterPlayer.deleteMany({
    where: { announcement: { upcomingGame: { opponent } } },
  });
  await prisma.gameRosterAnnouncement.deleteMany({
    where: { upcomingGame: { opponent } },
  });
  await prisma.upcomingGame.deleteMany({ where: { opponent } });

  await prisma.$disconnect();
}
