// Runs once after all E2E tests. Skipped when targeting a remote URL, where the
// deletes below would hit that deployment's database.
import { isLocalDatabase } from "./helpers/db-guard.js";

export default async function globalTeardown() {
  if (process.env.PLAYWRIGHT_BASE_URL) return;

  // Setup already failed loudly on a non-local DB, so nothing was created here.
  if (!isLocalDatabase()) return;

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
