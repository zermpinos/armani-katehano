/**
 * lib/data.js
 * Switched to Prisma/Neon data layer.
 */

export {
  getConfig,
  getSeasons,
  getPlayers,
  getGames,
  getAllGames,
  getBoxScore,
  getStats,
  getAllPublicData,
  getAllSeasonsStats,
  getAllUpcomingGames,
  getUpcomingGamesWithAnnouncements,
} from "./repository.prisma";

export {
  computeRecord,
  computeTeamAverages,
  buildStatsMap,
  buildAllTimeStatsMap,
  recalcPlayerAverages,
  calcEff,
  mergeAggregates,
} from "./stats";
