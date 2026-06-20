import "@/server/_internal/node-only";
import { getConfig } from "./config";
import { getSeasons } from "./seasons";
import { getPlayers } from "./players";
import { getGames } from "./games";
import { getStats } from "./stats";
import { getUpcomingGames } from "./upcoming-games";

export async function getAllPublicData(seasonName: string | null = null) {
  // Sequential probe so a missing DB rejects on one connection instead of
  // leaking 5 parallel WebSocket attempts for their full TCP timeout (~60s).
  const config = await getConfig();
  const activeSeason = seasonName ?? config.currentSeason;

  const [seasons, players, games, stats, upcomingGames] = await Promise.all([
    getSeasons(),
    getPlayers(),
    getGames(activeSeason),
    getStats(activeSeason),
    getUpcomingGames(),
  ]);

  return {
    config,
    seasons,
    currentSeason: activeSeason,
    players,
    games,
    stats,
    upcomingGames,
  };
}
