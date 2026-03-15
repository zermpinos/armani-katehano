/**
 * lib/data.js
 * Backward-compatibility shim — re-exports everything pages need.
 *
 * All real logic lives in:
 *   lib/repository.js  — Redis I/O and key management
 *   lib/stats.js       — pure computation
 *   lib/utils.js       — pure utilities
 *
 * Pages that have been updated to use repository.js directly
 * no longer need this file. It exists so any page not yet updated
 * continues to work without modification.
 */

export {
  // Config & seasons
  getConfig, setConfig,
  getSeasons, setSeasons, addSeason,
  // Players
  getPlayers, setPlayers,
  DEFAULT_PLAYERS,
  // Season-scoped data
  getGames, setGames,
  getSchedule, setSchedule,
  getStats, setStats,
  // Batch helpers
  getAllPublicData, getSeasonData, getAllSeasonsStats,
} from "./repository.js";

export {
  computeRecord,
  buildStatsMap,
  buildAllTimeStatsMap,
  recalcPlayerAverages,
  calcEff,
} from "./stats.js";
