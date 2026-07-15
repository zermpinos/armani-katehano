// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-import-integration";
});

const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    seasonLeague:   { findMany: vi.fn(), findFirst: vi.fn() },
    league:         { findFirst: vi.fn() },
    player:         { findMany: vi.fn() },
    game:           { findUnique: vi.fn(), create: vi.fn() },
    playerGameStat: { createMany: vi.fn() },
    $transaction:   vi.fn(),
  };
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/services/stats-recalc", () => ({
  recalcAggregates: vi.fn(),
}));
vi.mock("@/server/services/cache-invalidation", () => ({
  invalidateForGameMutation: vi.fn().mockResolvedValue(undefined),
}));

import { recalcAggregates } from "@/server/services/stats-recalc";
import { invalidateForGameMutation } from "@/server/services/cache-invalidation";
import { importGame, ImportError } from "@/server/services/import-game";

const SEASON_LEAGUE_ID = "clseasonleaguexxxxxxxxxx";
const PLAYER_ID        = "clplayerxxxxxxxxxxxxxxxx";
const CREATED_GAME_ID  = "clgamexxxxxxxxxxxxxxxxxx";
const SOURCE_URL       = "https://example.com/men/game/4711";

function scrapedPlayer(overrides = {}) {
  return {
    "#": 7,
    Players: "Test Player",
    MIN:  "20:00",
    PTS:  10,
    REB:  4,
    OREB: 1,
    DREB: 3,
    AST:  2,
    STL:  1,
    BLK:  0,
    TO:   1,
    PF:   2,
    "2PTS": { made: 5, attempted: 8 },
    "3PTS": { made: 0, attempted: 2 },
    FT:     { made: 0, attempted: 0 },
    ...overrides,
  };
}

function payload({ homeScore = 10, awayScore = 8, url = SOURCE_URL } = {}) {
  return {
    data: {
      url,
      game: {
        homeTeam:   "ARMANI KATEHANO",
        awayTeam:   "Rivals BC",
        finalScore: { home: homeScore, away: awayScore },
        date:       "Σάββατο, 28 Μαρτίου 2026",
      },
      teams: [
        { name: "ARMANI KATEHANO", players: [scrapedPlayer()] },
        { name: "Rivals BC",       players: [] },
      ],
    },
  };
}

let insideTx = false;

beforeEach(() => {
  vi.clearAllMocks();
  insideTx = false;

  mockPrisma.$transaction.mockImplementation(async (fn) => {
    insideTx = true;
    try {
      return await fn(mockPrisma);
    } finally {
      insideTx = false;
    }
  });

  mockPrisma.seasonLeague.findMany.mockResolvedValue([
    { id: SEASON_LEAGUE_ID, league: { slug: "bc8" } },
  ]);
  mockPrisma.player.findMany.mockResolvedValue([
    { id: PLAYER_ID, number: 7, slug: "test-player", isActive: true },
  ]);
  mockPrisma.game.findUnique.mockResolvedValue(null);
  mockPrisma.game.create.mockResolvedValue({ id: CREATED_GAME_ID });
  mockPrisma.playerGameStat.createMany.mockResolvedValue({ count: 1 });
  recalcAggregates.mockResolvedValue(undefined);
  invalidateForGameMutation.mockResolvedValue(undefined);
});

describe("importGame ingestion guards", () => {
  it("imports a well-formed payload", async () => {
    const result = await importGame(payload());
    expect(result.gameId).toBe(CREATED_GAME_ID);
    expect(result.playersImported).toBe(1);
    expect(result.opponent).toBe("Rivals BC");
    expect(result.location).toBe("home");
  });

  it("rejects a duplicate sourceUrl with 409 and echoes the existing gameId", async () => {
    const existingId = "cldupegamexxxxxxxxxxxxxx";
    mockPrisma.game.findUnique.mockResolvedValue({ id: existingId });

    const err = await importGame(payload()).catch((e) => e);

    expect(err).toBeInstanceOf(ImportError);
    expect(err.status).toBe(409);
    expect(err.gameId).toBe(existingId);
    expect(mockPrisma.game.create).not.toHaveBeenCalled();
  });

  it("rejects a box-score sum that disagrees with teamScore with 422", async () => {
    const err = await importGame(payload({ homeScore: 99 })).catch((e) => e);

    expect(err).toBeInstanceOf(ImportError);
    expect(err.status).toBe(422);
    expect(err.message).toMatch(/Box score points \(10\).*teamScore \(99\)/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("importGame aggregate transactionality", () => {
  it("recalculates aggregates inside the game-write transaction", async () => {
    let recalcSawOpenTx = false;
    recalcAggregates.mockImplementation(async () => {
      recalcSawOpenTx = insideTx;
    });

    await importGame(payload());

    expect(recalcAggregates).toHaveBeenCalledOnce();
    expect(recalcSawOpenTx).toBe(true);
  });

  it("passes the transaction client through to recalcAggregates", async () => {
    await importGame(payload());
    expect(recalcAggregates).toHaveBeenCalledWith(SEASON_LEAGUE_ID, mockPrisma, [PLAYER_ID]);
  });

  it("propagates a recalc failure instead of resolving with a clean result", async () => {
    recalcAggregates.mockRejectedValue(new Error("recalc exploded"));

    const err = await importGame(payload()).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("recalc exploded");
  });

  it("does not revalidate caches when recalc fails", async () => {
    recalcAggregates.mockRejectedValue(new Error("recalc exploded"));

    await importGame(payload()).catch(() => {});

    expect(invalidateForGameMutation).not.toHaveBeenCalled();
  });
});
