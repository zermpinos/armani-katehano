// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma, mockScrapeAndResolve, mockCommitImport, MockCommitError, mockFinishCronRun } = vi.hoisted(() => {
  class MockCommitError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  return {
    mockPrisma: {
      upcomingGame: { findMany: vi.fn() },
      game:         { findMany: vi.fn() },
    },
    mockScrapeAndResolve: vi.fn(),
    mockCommitImport:     vi.fn(),
    MockCommitError,
    mockFinishCronRun:    vi.fn(),
  };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/security/edge", () => ({ securityHeaders: () => ({ "X-Test": "1" }) }));
vi.mock("@/server/security/node",  () => ({ auditLog: vi.fn() }));
vi.mock("@/server/services/cron-run", () => ({
  startCronRun:  vi.fn().mockResolvedValue("run1"),
  finishCronRun: mockFinishCronRun,
}));
vi.mock("@/server/services/import-pipeline", () => ({ scrapeAndResolve: mockScrapeAndResolve }));
vi.mock("@/server/services/import-commit", () => ({
  commitImport: mockCommitImport,
  CommitError:  MockCommitError,
}));

import handler from "../../../../pages/api/cron/poll-imports";

const NOW        = new Date("2026-03-28T21:00:00Z");
const SOURCE_URL = "https://basketcity.sportstats.gr/men/gamedetails/id/4711";

const DRAFT = {
  date:           "2026-03-28",
  opponent:       "Rivals BC",
  home:           true,
  result:         "W",
  teamScore:      11,
  opponentScore:  8,
  seasonLeagueId: "clseasonleague0000000001",
  sourceUrl:      SOURCE_URL,
  boxScore: [{
    playerId: "clplayer00000000000000a1",
    min: 20, pts: 11, reb: 4, orb: 1, drb: 3,
    ast: 2, stl: 1, blk: 0, tov: 2, pf: 3,
    fgm: 4, fga: 7, fg2m: 3, fg2a: 5, fg3m: 1, fg3a: 2,
    ftm: 2, fta: 2, eff: 12,
  }],
};

function pipelineResult(over = {}) {
  return {
    data:              {},
    gameState:         { state: "final", reason: "all 4 quarters complete" },
    gate:              { ok: true, failures: [] },
    draft:             DRAFT,
    highlights:        {},
    unresolved:        [],
    unresolvedPlayers: [],
    ...over,
  };
}

function mockReq(overrides = {}) {
  return {
    method:  overrides.method  ?? "GET",
    headers: overrides.headers ?? { authorization: "Bearer test-secret" },
  };
}
function mockRes() {
  return {
    statusCode: 0, body: null,
    setHeader:  vi.fn(),
    revalidate: vi.fn().mockResolvedValue(undefined),
    status(c) { this.statusCode = c; return this; },
    json(b)   { this.body = b;       return this; },
  };
}

const summary = () => mockFinishCronRun.mock.calls[0][1].summary;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = "test-secret";
  mockPrisma.upcomingGame.findMany.mockResolvedValue([{ sourceUrl: SOURCE_URL }]);
  mockPrisma.game.findMany.mockResolvedValue([]);
  mockScrapeAndResolve.mockResolvedValue(pipelineResult());
  mockCommitImport.mockResolvedValue({ gameId: "clgame000000000000000001" });
});

describe("poll-imports auth", () => {
  it("returns 405 on non-GET", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
    expect(mockPrisma.upcomingGame.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer wrongxx" } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockScrapeAndResolve).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });
});

describe("poll-imports candidate selection", () => {
  // 36h, not 24h: the window has to outlast the daily interval or a game that
  // was still live at last night's run never gets a second attempt.
  it("takes at most 3 games that tipped off between 36h and 90min ago", async () => {
    await handler(mockReq(), mockRes());
    const args = mockPrisma.upcomingGame.findMany.mock.calls[0][0];
    expect(args.take).toBe(3);
    expect(args.where.sourceUrl).toEqual({ not: null });
    expect(args.where.scheduledFor).toEqual({
      gte: new Date(NOW.getTime() - 36 * 60 * 60 * 1000),
      lte: new Date(NOW.getTime() - 90 * 60 * 1000),
    });
  });

  it("does not scrape a URL that already has a game", async () => {
    mockPrisma.game.findMany.mockResolvedValue([{ sourceUrl: SOURCE_URL }]);
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockScrapeAndResolve).not.toHaveBeenCalled();
    expect(summary().skipped).toEqual([{ sourceUrl: SOURCE_URL, reason: "already imported" }]);
  });
});

describe("poll-imports commit gate", () => {
  it("commits a final, all-green, fully resolved scrape", async () => {
    const res = mockRes();
    await handler(mockReq(), res);

    expect(mockCommitImport).toHaveBeenCalledTimes(1);
    const [input] = mockCommitImport.mock.calls[0];
    expect(input.opponent).toBe("Rivals BC");
    expect(input.location).toBe("home");
    expect(input.sourceUrl).toBe(SOURCE_URL);
    // Mapped through the same toCommitInput the review form posts.
    expect(input.boxScore[0].minutes).toBe(20);
    expect(input.boxScore[0]).not.toHaveProperty("eff");
    expect(res.body).toEqual({ ok: true, committed: 1, skipped: 0 });
  });

  it("revalidates ISR paths through the cron response", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    const opts = mockCommitImport.mock.calls[0][1];
    await opts.revalidate("/games");
    expect(res.revalidate).toHaveBeenCalledWith("/games");
  });

  it("skips a game that is not final", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ gameState: { state: "live", reason: "Q4 open" } }));
    await handler(mockReq(), mockRes());
    expect(mockCommitImport).not.toHaveBeenCalled();
    expect(summary().skipped[0].reason).toBe("state live");
  });

  it("skips a scrape with any gate failure, including a non-blocking one", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({
      gate: { ok: false, failures: [{ check: "score", detail: "sums to 10, final says 11" }] },
    }));
    await handler(mockReq(), mockRes());
    expect(mockCommitImport).not.toHaveBeenCalled();
    expect(summary().skipped[0].reason).toBe("failed verification");
  });

  it("skips when the league did not resolve", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ unresolved: ["Pick a league."] }));
    await handler(mockReq(), mockRes());
    expect(mockCommitImport).not.toHaveBeenCalled();
    expect(summary().skipped[0].reason).toBe("league unresolved");
  });

  it("skips when a jersey that played is not on the roster", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ unresolvedPlayers: [{ number: 99, name: "New Guy" }] }));
    await handler(mockReq(), mockRes());
    expect(mockCommitImport).not.toHaveBeenCalled();
    expect(summary().skipped[0].reason).toBe("player not on roster");
  });

  it("skips a draft the write schema rejects", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ draft: { ...DRAFT, seasonLeagueId: "" } }));
    await handler(mockReq(), mockRes());
    expect(mockCommitImport).not.toHaveBeenCalled();
    expect(summary().skipped[0].reason).toBe("draft failed schema validation");
  });
});

describe("poll-imports resilience", () => {
  it("keeps going after one candidate throws", async () => {
    const second = "https://basketcity.sportstats.gr/men/gamedetails/id/4712";
    mockPrisma.upcomingGame.findMany.mockResolvedValue([{ sourceUrl: SOURCE_URL }, { sourceUrl: second }]);
    mockScrapeAndResolve
      .mockRejectedValueOnce(new Error("Upstream unreachable"))
      .mockResolvedValueOnce(pipelineResult({ draft: { ...DRAFT, sourceUrl: second } }));

    const res = mockRes();
    await handler(mockReq(), res);

    expect(mockCommitImport).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ ok: true, committed: 1, skipped: 1 });
    expect(summary().skipped[0]).toEqual({ sourceUrl: SOURCE_URL, reason: "Upstream unreachable" });
  });

  it("records a commit rejection as a skip rather than failing the run", async () => {
    mockCommitImport.mockRejectedValue(new MockCommitError("This game has already been imported.", 409));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(summary().skipped[0].reason).toBe("commit: This game has already been imported.");
    expect(mockFinishCronRun).toHaveBeenCalledWith("run1", expect.objectContaining({ ok: true }));
  });

  it("returns 500 and marks the run failed when the candidate query throws", async () => {
    mockPrisma.upcomingGame.findMany.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
    expect(mockFinishCronRun).toHaveBeenCalledWith("run1", { ok: false, error: "boom" });
  });
});
