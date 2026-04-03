/**
 * lib/data.js
 * Switched to Prisma/Neon data layer.
 */

export {
  getConfig,
  getSeasons,
  getPlayers,
  getGames,
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
} from "./stats.js";
