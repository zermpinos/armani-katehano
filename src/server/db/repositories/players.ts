import "@/server/_internal/node-only";
import prisma from "@/server/db/client";
import { calcEff } from "@/domain/stats";

function rowToGameLogEntry(r: any) {
  return {
    gameId:   r.gameId,
    date:     r.game.playedOn.toISOString().split("T")[0],
    opponent: r.game.opponent,
    league:   r.game.seasonLeague.league.slug,
    season:   r.game.seasonLeague.season.name,
    round:    r.game.round,
    pts:  r.pts,
    reb:  r.reb,
    orb:  r.orb,
    drb:  r.drb,
    ast:  r.ast,
    stl:  r.stl,
    blk:  r.blk,
    tov:  r.tov,
    pf:   r.pf,
    fgm:  r.fgm,
    fga:  r.fga,
    fg2m: r.fg2m,
    fg2a: r.fg2a,
    fg3m: r.fg3m,
    fg3a: r.fg3a,
    eff:  calcEff(r),
    min:  r.minutes,
    ftm:  r.ftm,
    fta:  r.fta,
  };
}

const GAME_LOG_INCLUDE = {
  game: {
    include: {
      seasonLeague: { include: { season: true, league: true } },
    },
  },
} as const;

export async function getPlayerGameLog(playerId: string) {
  const rows = await prisma.playerGameStat.findMany({
    where: { playerId, minutes: { gt: 0 } },
    include: GAME_LOG_INCLUDE,
    orderBy: { game: { playedOn: "asc" } },
  });
  return rows.map(rowToGameLogEntry);
}

export async function getAllPlayerGameLogs(): Promise<Record<string, ReturnType<typeof rowToGameLogEntry>[]>> {
  const rows = await prisma.playerGameStat.findMany({
    where: { minutes: { gt: 0 } },
    include: GAME_LOG_INCLUDE,
    orderBy: { game: { playedOn: "asc" } },
  });
  const result: Record<string, ReturnType<typeof rowToGameLogEntry>[]> = {};
  for (const r of rows) {
    if (!result[r.playerId]) result[r.playerId] = [];
    result[r.playerId].push(rowToGameLogEntry(r));
  }
  return result;
}

export async function getPlayers() {
  const players = await prisma.player.findMany({
    orderBy: { number: "asc" },
  });
  return players.map(p => ({
    id:       p.id,
    slug:     p.slug,
    number:   p.number,
    name:     p.name,
    position: p.position,
    height:   p.height ?? "",
    weight:   p.weight ?? "",
    photoUrl: p.photoUrl ?? null,
    isActive: p.isActive,
  }));
}
