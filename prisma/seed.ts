import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client.ts";
import { RAW_PLAYERS } from "./seed-data/players.ts";
import { RAW_GAMES } from "./seed-data/games.ts";
import { RAW_LEAGUES } from "./seed-data/leagues.ts";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function calcTsPct({ pts=0, fga=0, fta=0 }) {
  const denom = 2 * (fga + 0.44 * fta);
  return denom > 0 ? +((pts / denom) * 100).toFixed(1) : 0;
}

function pct(made, attempted) {
  return attempted > 0 ? +((made / attempted) * 100).toFixed(1) : 0;
}

// ─── Main seed ────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Season
  const season = await prisma.season.create({
    data: { name: "2025-26", year: 2025 },
  });
  console.log(`✅ Season: ${season.name}`);

  // 2. Leagues
  const leagues = {};
  for (const l of RAW_LEAGUES) {
    leagues[l.slug] = await prisma.league.create({ data: l });
  }
  console.log(`✅ Leagues: ${Object.keys(leagues).join(", ")}`);

  // 3. SeasonLeagues - one per league per season
  const seasonLeagues = {};
  for (const [slug, league] of Object.entries(leagues)) {
    const newSl = await prisma.seasonLeague.create({
      data: { seasonId: season.id, leagueId: league.id },
    });
    Reflect.set(seasonLeagues, slug, newSl);
  }
  console.log(`✅ SeasonLeagues created`);

  // 4. Players - slugs generated from names
  const playerMap = {}; // old pid -> new Prisma id
  for (const p of RAW_PLAYERS) {
    const created = await prisma.player.create({
      data: {
        slug:     slugify(p.name),
        name:     p.name,
        number:   p.number,
        position: p.position,
        isActive: true,
      },
    });
    playerMap[p.id] = created.id;

    // Roster entry for every SeasonLeague
    for (const sl of Object.values(seasonLeagues)) {
      await prisma.rosterEntry.create({
        data: { playerId: created.id, seasonLeagueId: sl.id, isActive: true },
      });
    }
  }
  console.log(`✅ Players: ${RAW_PLAYERS.length}`);

  // 5. Games + PlayerGameStats
  let gameCount = 0;
  let statCount = 0;

  for (const g of RAW_GAMES) {
    const [teamScore, opponentScore] = g.score.split("-").map(Number);
    const sl = seasonLeagues[g.league];

    const game = await prisma.game.create({
      data: {
        seasonLeagueId: sl.id,
        opponent:       g.opponent,
        location:       g.home ? "home" : "away",
        teamScore,
        opponentScore,
        result:         g.result,
        playedOn:       new Date(g.date),
      },
    });
    gameCount++;

    for (const row of g.boxScore) {
      const playerId = playerMap[row.pid];
      if (!playerId) continue;

      await prisma.playerGameStat.create({
        data: {
          playerId,
          gameId:    game.id,
          minutes:   row.min,
          pts:       row.pts,
          reb:       row.reb,
          orb:       row.orb,
          drb:       row.drb,
          ast:       row.ast,
          stl:       row.stl,
          blk:       row.blk,
          tov:       row.tov,
          pf:        row.pf,
          fgm:       row.fgm,
          fga:       row.fga,
          fg2m:      row.fg2m ?? (row.fgm - row.fg3m),
          fg2a:      row.fg2a ?? (row.fga - row.fg3a),
          fg3m:      row.fg3m,
          fg3a:      row.fg3a,
          ftm:       row.ftm,
          fta:       row.fta,
          plusMinus: 0,
        },
      });
      statCount++;
    }
  }
  console.log(`✅ Games: ${gameCount}, PlayerGameStats: ${statCount}`);

  // 6. PlayerSeasonAggregates - computed from raw stats per player per SeasonLeague
  let aggCount = 0;

  for (const [slSlug, sl] of Object.entries(seasonLeagues)) {
    const slGames = await prisma.game.findMany({
      where: { seasonLeagueId: sl.id },
      include: { playerStats: true },
    });

    for (const rawPlayer of RAW_PLAYERS) {
      const playerId = playerMap[rawPlayer.id];

      const rows = slGames
        .flatMap(g => g.playerStats)
        .filter(r => r.playerId === playerId && r.minutes > 0);

      const gp = rows.length;
      if (gp === 0) continue;

      const sum = (key: string) => rows.reduce((a, r) => a + (Reflect.get(r as object, key) as number || 0), 0);
      const avg = key => +(sum(key) / gp).toFixed(2);

      const totalFgm  = sum("fgm");
      const totalFga  = sum("fga");
      const totalFg3m = sum("fg3m");
      const totalFg3a = sum("fg3a");
      const totalFtm  = sum("ftm");
      const totalFta  = sum("fta");
      const totalPts  = sum("pts");
      const totalReb  = sum("reb");
      const totalAst  = sum("ast");

      const tsPctVal = calcTsPct({ pts: totalPts, fga: totalFga, fta: totalFta });

      await prisma.playerSeasonAggregate.create({
        data: {
          playerId,
          seasonLeagueId: sl.id,
          gp,
          ptsAvg:     avg("pts"),
          rebAvg:     avg("reb"),
          orbAvg:     avg("orb"),
          drbAvg:     avg("drb"),
          astAvg:     avg("ast"),
          stlAvg:     avg("stl"),
          blkAvg:     avg("blk"),
          toAvg:      avg("tov"),
          pfAvg:      avg("pf"),
          minutesAvg: avg("minutes"),
          fgPct:      pct(totalFgm,  totalFga),
          fg2Pct:     pct(sum("fg2m"), sum("fg2a")),
          fg3Pct:     pct(totalFg3m, totalFg3a),
          ftPct:      pct(totalFtm,  totalFta),
          tsPct:      tsPctVal,
          ptsTotal:   totalPts,
          rebTotal:   totalReb,
          astTotal:   totalAst,
        },
      });
      aggCount++;
    }
  }
  console.log(`✅ PlayerSeasonAggregates: ${aggCount}`);
  console.log("🏀 Seed complete.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
