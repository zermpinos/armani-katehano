/**
 * scripts/migrate-to-seasons.js
 *
 * One-time migration from the flat ak:* schema to the season-scoped schema.
 *
 * Reads:
 *   ak:games    → migrates to ak:season:2025-26:games
 *   ak:players  → strips stats/gameLog/photoUrl → writes to ak:players (bio only)
 *
 * Writes:
 *   ak:config                  → { currentSeason: "2025-26" }
 *   ak:seasons                 → ["2025-26"]
 *   ak:players                 → PlayerBio[]  (no stats, no gameLog, no photoUrl)
 *   ak:season:2025-26:games    → Game[]  (unchanged from ak:games)
 *   ak:season:2025-26:schedule → []  (schedule was empty / not migrated)
 *   ak:season:2025-26:stats    → { [pid]: SeasonStats }  (freshly computed)
 *
 * Safe to run multiple times — all writes are idempotent.
 *
 * Usage:
 *   node -r dotenv/config scripts/migrate-to-seasons.js
 *   (requires .env.local with KV_REST_API_URL and KV_REST_API_TOKEN)
 */

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url:   process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const SEASON = "2025-26";

// ── Inline buildStatsMap (no imports — script is standalone) ──────────────────
function buildStatsMap(players, games) {
  const statsMap = {};
  for (const player of players) {
    const rows = games
      .filter(g => g.boxScore)
      .flatMap(g => g.boxScore.filter(r => r.pid === player.id && r.min > 0));

    if (rows.length === 0) {
      statsMap[player.id] = {
        ppg:0,rpg:0,orpg:0,drpg:0,apg:0,spg:0,bpg:0,
        tpg:0,fpg:0,fgPct:0,fg2Pct:0,fg3Pct:0,ftPct:0,mpg:0,eff:0,
        gp:0, gameLog:[],
      };
      continue;
    }
    const n   = rows.length;
    const sum = f => rows.reduce((a,r) => a + (r[f]||0), 0);
    const avg = f => +(sum(f)/n).toFixed(1);
    const pct = (m,a) => { const t=sum(a); return t>0 ? +(sum(m)/t*100).toFixed(1) : 0; };

    const gameLog = games
      .filter(g => g.boxScore)
      .map(g => {
        const r = g.boxScore.find(r => r.pid === player.id && r.min > 0);
        if (!r) return null;
        return { gameId:g.id, date:g.date||"", opponent:g.opponent||"", league:g.league||"",
                 pts:r.pts||0, reb:r.reb||0, ast:r.ast||0, stl:r.stl||0, blk:r.blk||0, eff:r.eff||0 };
      })
      .filter(Boolean)
      .sort((a,b) => new Date(a.date)-new Date(b.date));

    statsMap[player.id] = {
      ppg:avg("pts"), rpg:avg("reb"), orpg:avg("orb"), drpg:avg("drb"),
      apg:avg("ast"), spg:avg("stl"), bpg:avg("blk"), tpg:avg("tov"), fpg:avg("pf"),
      fgPct:pct("fgm","fga"), fg2Pct:pct("fg2m","fg2a"),
      fg3Pct:pct("fg3m","fg3a"), ftPct:pct("ftm","fta"),
      mpg:avg("min"), eff:avg("eff"),
      gp:n, gameLog,
    };
  }
  return statsMap;
}

async function migrate() {
  console.log("── Armani Katehano · Season Migration ──────────────────");
  console.log(`Target season: ${SEASON}`);
  console.log("");

  // ── 1. Read existing data ─────────────────────────────────────────────────
  console.log("Reading ak:games and ak:players from Redis...");
  const [oldGames, oldPlayers] = await Promise.all([
    redis.get("ak:games"),
    redis.get("ak:players"),
  ]);

  const games   = oldGames   ?? [];
  const players = oldPlayers ?? [];

  console.log(`  Found ${games.length} games, ${players.length} players`);
  console.log("");

  // ── 2. Strip players to bio only (no stats, no gameLog, no photoUrl) ───────
  console.log("Stripping player stats / gameLog / photoUrl...");
  const playersBio = players.map(({ id, number, name, position, height, weight, age }) => ({
    id, number, name, position,
    height: height || "",
    weight: weight || "",
    age:    age    ?? null,
  }));
  console.log(`  ${playersBio.length} players bio-only`);
  console.log("");

  // ── 3. Recompute stats map ────────────────────────────────────────────────
  console.log("Computing stats map from box scores...");
  const statsMap  = buildStatsMap(playersBio, games);
  const activePids = Object.values(statsMap).filter(s => s.gp > 0).length;
  console.log(`  ${activePids} players with stats (gp > 0)`);
  console.log("");

  // ── 4. Write new keys ─────────────────────────────────────────────────────
  console.log("Writing new keys...");

  await redis.set("ak:config",  { currentSeason: SEASON });
  console.log("  ✓ ak:config");

  await redis.set("ak:seasons", [SEASON]);
  console.log("  ✓ ak:seasons");

  await redis.set("ak:players", playersBio);
  console.log("  ✓ ak:players  (bio only)");

  await redis.set(`ak:season:${SEASON}:games`, games);
  console.log(`  ✓ ak:season:${SEASON}:games  (${games.length} games)`);

  await redis.set(`ak:season:${SEASON}:schedule`, []);
  console.log(`  ✓ ak:season:${SEASON}:schedule  (empty)`);

  await redis.set(`ak:season:${SEASON}:stats`, statsMap);
  console.log(`  ✓ ak:season:${SEASON}:stats  (${Object.keys(statsMap).length} player entries)`);

  console.log("");
  console.log("── Migration complete ───────────────────────────────────");
  console.log("");
  console.log("You can now delete these legacy keys from Redis:");
  console.log("  ak:team");
  console.log("  ak:record");
  console.log("  ak:games    ← replaced by ak:season:2025-26:games");
  console.log("  ak:schedule ← replaced by ak:season:2025-26:schedule");
  console.log("(ak:players was updated in-place — no separate legacy key)");
  console.log("");
  console.log("Verify the site works correctly before deleting legacy keys.");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
