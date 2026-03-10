/**
 * pages/api/admin/data.js
 * GET  /api/admin/data          → returns all KV data for admin panel
 * POST /api/admin/data          → saves one or more data keys
 *
 * Body shape for POST:
 *   { key: "players"|"games"|"schedule"|"record"|"team", value: <any> }
 *
 * All routes are protected by session cookie via requireAuth.
 */

import { requireAuth }  from "../../../lib/requireAuth.js";
import { securityHeaders, auditLog } from "../../../lib/security.js";
import {
  getTeam, getRecord, getPlayers, getGames, getSchedule,
  setTeam, setRecord, setPlayers, setGames, setSchedule,
  recalcPlayerAverages, calcEff,
} from "../../../lib/data.js";

async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";

  // ── GET — return all data ──────────────────────────────────────────────────
  if (req.method === "GET") {
    const [team, record, players, games, schedule] = await Promise.all([
      getTeam(), getRecord(), getPlayers(), getGames(), getSchedule(),
    ]);
    return res.status(200).json({ team, record, players, games, schedule });
  }

  // ── POST — save data ───────────────────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { key, value } = req.body ?? {};
  const ALLOWED_KEYS = ["team", "record", "players", "games", "schedule"];

  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: `Invalid key. Must be one of: ${ALLOWED_KEYS.join(", ")}` });
  }

  if (value === undefined || value === null) {
    return res.status(400).json({ error: "Missing value" });
  }

  try {
    switch (key) {
      case "team":     await setTeam(value);     break;
      case "record":   await setRecord(value);   break;
      case "schedule": await setSchedule(value); break;

      case "players":
        // When players are saved directly (e.g. from player editor)
        await setPlayers(value);
        break;

      case "games": {
        // After saving games, auto-recalc all player season averages
        await setGames(value);
        const players = await getPlayers();
        // Attach eff to every box score row that's missing it
        const gamesWithEff = value.map(g => ({
          ...g,
          boxScore: (g.boxScore || []).map(r => ({
            ...r,
            eff: r.eff ?? calcEff(r),
          })),
        }));
        const updated = recalcPlayerAverages(players, gamesWithEff);
        await setGames(gamesWithEff);
        await setPlayers(updated);
        break;
      }
    }

    auditLog("admin_data_saved", { ip, key });
    return res.status(200).json({ ok: true });
  } catch (err) {
    auditLog("admin_data_error", { ip, key, error: err.message });
    return res.status(500).json({ error: "Failed to save data" });
  }
}

export default requireAuth(handler);
