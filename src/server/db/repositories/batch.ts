import "@/server/_internal/node-only";
import { getConfig } from "./config";
import { getSeasons } from "./seasons";
import { getPlayers } from "./players";
import { getGames } from "./games";
import { getStats } from "./stats";
import { getUpcomingGames } from "./upcoming-games";
import { getAwardsForArchivedSeasons, getArchivedSeasonNames } from "./awards";

export async function getAllPublicData(seasonName: string | null = null) {
  // No DATABASE_URL (e.g. CI build): reject immediately. Otherwise the Neon
  // WebSocket connect hangs to its ~60s TCP timeout, which exceeds the
  // per-page static-build limit and fails the build.
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  // Sequential probe so a missing DB rejects on one connection instead of
  // leaking 5 parallel WebSocket attempts for their full TCP timeout (~60s).
  const config = await getConfig();
  const activeSeason = seasonName ?? config.currentSeason;

  const [seasons, players, games, stats, upcomingGames, archivedSeasonNames, awardsBySeasonName] = await Promise.all([
    getSeasons(),
    getPlayers(),
    getGames(activeSeason),
    getStats(activeSeason),
    getUpcomingGames(),
    getArchivedSeasonNames(),
    getAwardsForArchivedSeasons(),
  ]);

  return {
    config,
    seasons,
    currentSeason: activeSeason,
    players,
    games,
    stats,
    upcomingGames,
    archivedSeasonNames,
    awardsBySeasonName,
  };
}
