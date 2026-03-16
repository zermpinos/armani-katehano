/**
 * pages/api/admin/data.js
 * GET  /api/admin/data          -> returns all data for admin panel
 * POST /api/admin/data          -> saves one data key
 *
 * All routes protected by session cookie via requireAuth.
 *
 * POST body:
 *   { key: "players"|"games"|"schedule"|"config"|"seasons", value, season? }
 *
 * The `season` field is required for key = "games" | "schedule" | "stats".
 * It defaults to config.currentSeason when omitted.
 */

import { requireAuth }           from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security.js";
import {
  getConfig, setConfig,
  getSeasons, setSeasons, addSeason,
  getPlayers, setPlayers,
  getGames,   setGames,
  getSchedule, setSchedule,
  getStats,   setStats,
} from "../../../lib/repository.js";
import { buildStatsMap, calcEff } from "../../../lib/stats.js";

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── GET -- return all admin data ───────────────────────────────────────────
  if (req.method === "GET") {
    const config  = await getConfig();
    const seasons = await getSeasons();
    const players = await getPlayers();
    const sid     = req.query.season || config.currentSeason;
    const [games, schedule, stats] = await Promise.all([
      getGames(sid),
      getSchedule(sid),
      getStats(sid),
    ]);
    return res.status(200).json({ config, seasons, players, games, schedule, stats, currentSeason: sid });
  }

  // ── POST -- save data ──────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { key, value, season: reqSeason } = req.body ?? {};
  const ALLOWED_KEYS = ["config", "seasons", "players", "games", "schedule"];

  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `Invalid key. Must be one of: ${ALLOWED_KEYS.join(", ")}` });
  }
  if (value === undefined || value === null) {
    return res.status(400).json({ error: "Missing value" });
  }

  try {
    // Resolve which season to write to
    const config = await getConfig();
    const sid    = reqSeason || config.currentSeason;

    switch (key) {
      case "config": {
        await setConfig(value);
        // If currentSeason changed, ensure it's registered in the seasons list
        if (value.currentSeason) await addSeason(value.currentSeason);
        break;
      }

      case "seasons": {
        await setSeasons(value);
        break;
      }

      case "players": {
        await setPlayers(value);
        break;
      }

      case "schedule": {
        await setSchedule(sid, value);
        break;
      }

      case "games": {
        // Attach eff to any box score row missing it
        const gamesWithEff = value.map(g => ({
          ...g,
          boxScore: (g.boxScore || []).map(r => ({
            ...r,
            eff: r.eff ?? calcEff(r),
          })),
        }));

        // Write games
        await setGames(sid, gamesWithEff);

        // Recompute and persist stats map for this season
        const players  = await getPlayers();
        const statsMap = buildStatsMap(players, gamesWithEff);
        await setStats(sid, statsMap);
        break;
      }
    }

    auditLog("admin_data_saved", { ip, key, season: sid });
    return res.status(200).json({ ok: true });
  } catch (err) {
    auditLog("admin_data_error", { ip, key, error: err.message });
    return res.status(500).json({ error: "Failed to save data" });
  }
}

export default requireAuth(handler);
