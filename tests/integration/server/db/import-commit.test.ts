// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-import-commit";
});

const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    player:         { findMany: vi.fn() },
    game:           { findUnique: vi.fn(), create: vi.fn() },
    playerGameStat: { createMany: vi.fn() },
    upcomingGame:   { deleteMany: vi.fn() },
    auditLog:       { create: vi.fn() },
    importDraft:    { updateMany: vi.fn(), create: vi.fn(), findFirst: vi.fn() },
    $transaction:   vi.fn(),
  };
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/services/stats-recalc", () => ({ recalcAggregates: vi.fn() }));
vi.mock("@/server/services/cache-invalidation", () => ({
  invalidateForGameMutation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/integrations/email/client", () => ({
  sendImportNotification: vi.fn().mockResolvedValue(undefined),
}));

import { recalcAggregates } from "@/server/services/stats-recalc";
import { invalidateForGameMutation } from "@/server/services/cache-invalidation";
import { sendImportNotification } from "@/server/integrations/email/client";
import { commitImport, captureImportDraft, CommitError } from "@/server/services/import-commit";

const SEASON_LEAGUE_ID = "clseasonleaguexxxxxxxxxx";
const PLAYER_ID        = "clplayerxxxxxxxxxxxxxxxx";
const CREATED_GAME_ID  = "clgamexxxxxxxxxxxxxxxxxx";
const SOURCE_URL       = "https://example.com/men/game/4711";

function boxRow(overrides = {}) {
  return {
    playerId: PLAYER_ID,
    minutes: 20, pts: 10, reb: 4, orb: 1, drb: 3,
    ast: 2, stl: 1, blk: 0, tov: 1, pf: 2,
    fgm: 5, fga: 10, fg2m: 5, fg2a: 8, fg3m: 0, fg3a: 2,
    ftm: 0, fta: 0,
    ...overrides,
  };
}

function commitData({ teamScore = 10, sourceUrl = SOURCE_URL } = {}) {
  return {
    seasonLeagueId: SEASON_LEAGUE_ID,
    opponent: "Rivals BC",
    location: "home",
    teamScore,
    opponentScore: 8,
    result: "W",
    playedOn: "2026-03-28",
    sourceUrl,
    round: "regular",
    boxScore: [boxRow()],
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

  mockPrisma.game.findUnique.mockResolvedValue(null);
  mockPrisma.game.create.mockResolvedValue({ id: CREATED_GAME_ID });
  mockPrisma.playerGameStat.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.upcomingGame.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.player.findMany.mockResolvedValue([{ slug: "test-player" }]);
  mockPrisma.auditLog.create.mockResolvedValue({});
  mockPrisma.importDraft.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.importDraft.create.mockResolvedValue({});
  mockPrisma.importDraft.findFirst.mockResolvedValue(null);
  recalcAggregates.mockResolvedValue(undefined);
  invalidateForGameMutation.mockResolvedValue(undefined);
  sendImportNotification.mockResolvedValue(undefined);
});

describe("commitImport guards", () => {
  it("commits a well-formed draft", async () => {
    const { gameId } = await commitImport(commitData());
    expect(gameId).toBe(CREATED_GAME_ID);
    expect(mockPrisma.playerGameStat.createMany).toHaveBeenCalledOnce();
  });

  it("rejects a duplicate sourceUrl with 409 and echoes the existing gameId", async () => {
    const existingId = "cldupegamexxxxxxxxxxxxxx";
    mockPrisma.game.findUnique.mockResolvedValue({ id: existingId });

    const err = await commitImport(commitData()).catch(e => e);

    expect(err).toBeInstanceOf(CommitError);
    expect(err.status).toBe(409);
    expect(err.gameId).toBe(existingId);
    expect(mockPrisma.game.create).not.toHaveBeenCalled();
  });

  it("rejects a box-score sum that disagrees with teamScore with 422", async () => {
    const err = await commitImport(commitData({ teamScore: 99 })).catch(e => e);

    expect(err).toBeInstanceOf(CommitError);
    expect(err.status).toBe(422);
    expect(err.message).toMatch(/Box score points \(10\).*teamScore \(99\)/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("skips the duplicate pre-check when there is no sourceUrl", async () => {
    await commitImport(commitData({ sourceUrl: null }));
    expect(mockPrisma.game.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.game.create).toHaveBeenCalledOnce();
  });
});

describe("commitImport transactionality", () => {
  it("recalculates aggregates inside the game-write transaction", async () => {
    let recalcSawOpenTx = false;
    recalcAggregates.mockImplementation(async () => { recalcSawOpenTx = insideTx; });

    await commitImport(commitData());

    expect(recalcAggregates).toHaveBeenCalledOnce();
    expect(recalcSawOpenTx).toBe(true);
  });

  it("passes the transaction client and affected players through to recalcAggregates", async () => {
    await commitImport(commitData());
    expect(recalcAggregates).toHaveBeenCalledWith(SEASON_LEAGUE_ID, mockPrisma, [PLAYER_ID]);
  });

  it("propagates a recalc failure instead of resolving with a clean result", async () => {
    recalcAggregates.mockRejectedValue(new Error("recalc exploded"));
    const err = await commitImport(commitData()).catch(e => e);
    expect(err.message).toBe("recalc exploded");
  });

  it("does not revalidate caches or notify when recalc fails", async () => {
    recalcAggregates.mockRejectedValue(new Error("recalc exploded"));

    await commitImport(commitData()).catch(() => {});

    expect(invalidateForGameMutation).not.toHaveBeenCalled();
    expect(sendImportNotification).not.toHaveBeenCalled();
  });
});

describe("commitImport notification", () => {
  it("sends the admin alert once on a committed game", async () => {
    await commitImport(commitData());
    expect(sendImportNotification).toHaveBeenCalledOnce();
    expect(sendImportNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "success", opponent: "Rivals BC", location: "home" }),
    );
  });

  it("does not send the alert on a duplicate", async () => {
    mockPrisma.game.findUnique.mockResolvedValue({ id: "cldupegamexxxxxxxxxxxxxx" });
    await commitImport(commitData()).catch(() => {});
    expect(sendImportNotification).not.toHaveBeenCalled();
  });

  it("still resolves when the alert fails to send", async () => {
    sendImportNotification.mockRejectedValue(new Error("smtp down"));
    const { gameId } = await commitImport(commitData());
    expect(gameId).toBe(CREATED_GAME_ID);
  });
});

describe("import draft capture", () => {
  const RAW  = { game: { homeTeam: "A" }, teams: [] };
  const HASH = "a".repeat(64);

  it("overwrites an uncommitted capture in place", async () => {
    await captureImportDraft(SOURCE_URL, RAW, HASH);
    expect(mockPrisma.importDraft.updateMany).toHaveBeenCalledWith({
      where: { sourceUrl: SOURCE_URL, gameId: null },
      data:  { rawPayload: RAW, bytesHash: HASH, sourceKind: "sportstats-html" },
    });
    expect(mockPrisma.importDraft.create).not.toHaveBeenCalled();
  });

  it("creates the row on a first scrape", async () => {
    mockPrisma.importDraft.updateMany.mockResolvedValue({ count: 0 });
    await captureImportDraft(SOURCE_URL, RAW, HASH);
    expect(mockPrisma.importDraft.create).toHaveBeenCalledOnce();
  });

  it("leaves a committed capture untouched rather than replacing its bytes", async () => {
    mockPrisma.importDraft.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.importDraft.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(captureImportDraft(SOURCE_URL, RAW, HASH)).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("never lets a capture failure reach the caller", async () => {
    mockPrisma.importDraft.updateMany.mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(captureImportDraft(SOURCE_URL, RAW, HASH)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("freezes the capture inside the commit transaction", async () => {
    await commitImport(commitData());
    expect(mockPrisma.importDraft.updateMany).toHaveBeenCalledWith({
      where: { sourceUrl: SOURCE_URL, gameId: null },
      data:  { gameId: CREATED_GAME_ID },
    });
  });

  it("skips the freeze when the game has no source URL", async () => {
    await commitImport(commitData({ sourceUrl: null }));
    expect(mockPrisma.importDraft.updateMany).not.toHaveBeenCalled();
  });
});

describe("server-side gate", () => {
  function scrapedPlayer(over = {}) {
    return {
      "#": 4, Players: "Player Four", MIN: "20:00", PTS: 10,
      REB: 5, OREB: 2, DREB: 3, AST: 1, STL: 0, BLK: 0, TO: 2, PF: 3,
      "2PTS": { made: 2, attempted: 5 },
      "3PTS": { made: 1, attempted: 3 },
      FT:     { made: 3, attempted: 4 },
      EF: 11,
      ...over,
    };
  }

  function rawPayload({ home = [scrapedPlayer()], awayScore = 8 } = {}) {
    return {
      game: {
        homeTeam: "ARMANI KATEHANO",
        awayTeam: "Rivals BC",
        date: "Σάββατο, 28 Μαρτίου 2026",
        finalScore: { home: 10, away: awayScore },
        quarterScores: [
          { quarter: "Q1", home: 3, away: 2 },
          { quarter: "Q2", home: 3, away: 2 },
          { quarter: "Q3", home: 2, away: 2 },
          { quarter: "Q4", home: 2, away: 2 },
        ],
      },
      teams: [
        { name: "ARMANI KATEHANO", players: home },
        { name: "Rivals BC", players: [scrapedPlayer({
          "#": 9, Players: "Rival Nine", PTS: 8,
          "2PTS": { made: 4, attempted: 9 },
          "3PTS": { made: 0, attempted: 1 },
          FT:     { made: 0, attempted: 0 },
        })] },
      ],
    };
  }

  const auditData = () => mockPrisma.auditLog.create.mock.calls[0][0].data.data;

  it("rejects a commit whose captured bytes are missing a required column", async () => {
    const { EF, ...noEf } = scrapedPlayer();
    mockPrisma.importDraft.findFirst.mockResolvedValue({ rawPayload: rawPayload({ home: [noEf] }) });

    const err = await commitImport(commitData()).catch(e => e);

    expect(err).toBeInstanceOf(CommitError);
    expect(err.status).toBe(422);
    expect(err.message).toMatch(/missing column\(s\) EF/);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("commits despite a non-blocking failure and records it on the audit line", async () => {
    mockPrisma.importDraft.findFirst.mockResolvedValue({ rawPayload: rawPayload({ awayScore: 9 }) });

    const { gameId } = await commitImport(commitData());

    expect(gameId).toBe(CREATED_GAME_ID);
    expect(auditData().gateFailures).toEqual([
      expect.objectContaining({ check: "score" }),
    ]);
  });

  it("commits with no gate when the source URL has no live capture", async () => {
    const { gameId } = await commitImport(commitData());
    expect(gameId).toBe(CREATED_GAME_ID);
    expect(auditData()).not.toHaveProperty("gateFailures");
  });

  it("reads only the uncommitted capture", async () => {
    await commitImport(commitData());
    expect(mockPrisma.importDraft.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sourceUrl: SOURCE_URL, gameId: null } }),
    );
  });

  it("does not look for a capture when the game has no source URL", async () => {
    await commitImport(commitData({ sourceUrl: null }));
    expect(mockPrisma.importDraft.findFirst).not.toHaveBeenCalled();
  });

  it("ignores a gate result supplied by the caller", async () => {
    const { EF, ...noEf } = scrapedPlayer();
    mockPrisma.importDraft.findFirst.mockResolvedValue({ rawPayload: rawPayload({ home: [noEf] }) });

    const err = await commitImport({ ...commitData(), gateFailures: [] }).catch(e => e);

    expect(err.status).toBe(422);
  });
});
