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
} from "./repository.prisma.js";

export {
  computeRecord,
  buildStatsMap,
  buildAllTimeStatsMap,
  recalcPlayerAverages,
  calcEff,
  mergeAggregates,
} from "./stats.js";
