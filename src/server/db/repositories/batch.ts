import { getConfig } from "./config";
import { getSeasons } from "./seasons";
import { getPlayers } from "./players";
import { getGames } from "./games";
import { getStats } from "./stats";
import { getUpcomingGames } from "./upcoming-games";

export async function getAllPublicData(seasonName: string | null = null) {
  const [config, seasons, players] = await Promise.all([
    getConfig(),
    getSeasons(),
    getPlayers(),
  ]);

  const activeSeason = seasonName ?? config.currentSeason;

  const [games, stats, upcomingGames] = await Promise.all([
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
