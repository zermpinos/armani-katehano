// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma, mockDiscover, mockScrapeAndResolve, mockCommitImport, MockCommitError, mockFinishCronRun, mockNotify } = vi.hoisted(() => {
  class MockCommitError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  return {
    mockPrisma:           { game: { findMany: vi.fn() } },
    mockDiscover:         vi.fn(),
    mockScrapeAndResolve: vi.fn(),
    mockCommitImport:     vi.fn(),
    MockCommitError,
    mockFinishCronRun:    vi.fn(),
    mockNotify:           vi.fn(),
  };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/security/edge", () => ({ securityHeaders: () => ({ "X-Test": "1" }) }));
vi.mock("@/server/security/node",  () => ({ auditLog: vi.fn() }));
vi.mock("@/server/services/cron-run", () => ({
  startCronRun:  vi.fn().mockResolvedValue("run1"),
  finishCronRun: mockFinishCronRun,
}));
vi.mock("@/server/services/discover-games", () => ({ discoverGames: mockDiscover }));
vi.mock("@/server/services/import-pipeline", () => ({ scrapeAndResolve: mockScrapeAndResolve }));
vi.mock("@/server/services/import-commit", () => ({
  commitImport: mockCommitImport,
  CommitError:  MockCommitError,
}));
vi.mock("@/server/integrations/email/client", () => ({ sendImportNotification: mockNotify }));

import handler from "../../../../pages/api/cron/poll-imports";

const NOW     = new Date("2026-03-28T21:00:00Z");
const GAME_ID = "172B9468-3076-4D51-ADF8-560555B99406";
const BASE    = "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/";
const SOURCE_URL = BASE + GAME_ID;

// Played today, so well inside the window with days of runs still to come.
const TODAY      = "Σάββατο, 28 Μαρτίου 2026";
// Past LAST_RUN_MS: tonight is the final run that will see it.
const LAST_WEEK  = "Κυριακή, 22 Μαρτίου 2026";
// Outside the seven day window entirely.
const LONG_AGO   = "Παρασκευή, 20 Μαρτίου 2026";

const listed = (over = {}) => ({
  gameId: GAME_ID, url: SOURCE_URL, leagueSlug: "wintercup",
  round: "regular", dateText: TODAY, hasScore: true, ...over,
});

const DRAFT = {
  date: "2026-03-28", opponent: "Rivals BC", home: true, result: "W",
  teamScore: 11, opponentScore: 8, seasonLeagueId: "clseasonleague0000000001",
  sourceUrl: SOURCE_URL,
  boxScore: [{
    playerId: "clplayer00000000000000a1",
    min: 20, pts: 11, reb: 4, orb: 1, drb: 3, ast: 2, stl: 1, blk: 0, tov: 2, pf: 3,
    fgm: 4, fga: 7, fg2m: 3, fg2a: 5, fg3m: 1, fg3a: 2, ftm: 2, fta: 2, eff: 12,
  }],
};

const pipelineResult = (over = {}) => ({
  data: {}, gameState: { state: "final", reason: "all 4 quarters complete" },
  gate: { ok: true, failures: [] }, draft: DRAFT, highlights: {},
  unresolved: [], unresolvedPlayers: [], ...over,
});

const mockReq = (o = {}) => ({
  method:  o.method  ?? "GET",
  headers: o.headers ?? { authorization: "Bearer test-secret" },
});
const mockRes = () => ({
  statusCode: 0, body: null,
  setHeader:  vi.fn(),
  revalidate: vi.fn().mockResolvedValue(undefined),
  status(c) { this.statusCode = c; return this; },
  json(b)   { this.body = b;       return this; },
});

const summary = () => mockFinishCronRun.mock.calls[0][1].summary;
const alert   = () => mockNotify.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = "test-secret";
  mockDiscover.mockResolvedValue({ games: [listed()], errors: [] });
  mockPrisma.game.findMany.mockResolvedValue([]);
  mockScrapeAndResolve.mockResolvedValue(pipelineResult());
  mockCommitImport.mockResolvedValue({ gameId: "clgame000000000000000001" });
  mockNotify.mockResolvedValue(undefined);
});

describe("poll-imports auth", () => {
  it("returns 405 on non-GET", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
    expect(mockDiscover).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer wrongxx" } }), res);
    expect(res.statusCode).toBe(401);
    expect(mockDiscover).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(401);
  });
});

describe("poll-imports candidate selection", () => {
  // The same game has been served under /winter-cup/ and /super-winter-cup/,
  // and one stored URL ends in a newline, so the string is not an identity.
  it("treats a game id as imported however its stored URL is spelt", async () => {
    mockPrisma.game.findMany.mockResolvedValue([
      { sourceUrl: `https://basketcity.sportstats.gr/super-winter-cup/gamedetails/id/${GAME_ID}\n` },
    ]);
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockScrapeAndResolve).not.toHaveBeenCalled();
    expect(res.body).toEqual({ ok: true, committed: 0, skipped: 0 });
  });

  it("ignores a game played longer ago than the window", async () => {
    mockDiscover.mockResolvedValue({ games: [listed({ dateText: LONG_AGO })], errors: [] });
    await handler(mockReq(), mockRes());
    expect(mockScrapeAndResolve).not.toHaveBeenCalled();
  });

  it("takes at most three, newest first", async () => {
    const day = n => ({ ...listed(), gameId: `id-${n}`, url: BASE + n, dateText: `2${n} Μαρτίου 2026` });
    mockDiscover.mockResolvedValue({ games: [day(3), day(7), day(5), day(6)], errors: [] });
    await handler(mockReq(), mockRes());
    expect(mockScrapeAndResolve).toHaveBeenCalledTimes(3);
    expect(mockScrapeAndResolve.mock.calls.map(c => c[0])).toEqual([BASE + 7, BASE + 6, BASE + 5]);
  });

  it("reports a listing that could not be read, and does not go quiet about it", async () => {
    mockDiscover.mockResolvedValue({ games: [], errors: ["SCRAPE_LISTING_URL_MEN: Upstream unreachable"] });
    await handler(mockReq(), mockRes());
    expect(summary().skipped[0]).toEqual({
      sourceUrl: "listing", reason: "SCRAPE_LISTING_URL_MEN: Upstream unreachable", transient: false,
    });
    expect(mockNotify).toHaveBeenCalledTimes(1);
  });
});

describe("poll-imports commit gate", () => {
  it("commits a final, all-green, fully resolved scrape", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockCommitImport).toHaveBeenCalledTimes(1);
    const [input] = mockCommitImport.mock.calls[0];
    expect(input.opponent).toBe("Rivals BC");
    expect(input.boxScore[0].minutes).toBe(20);
    expect(res.body).toEqual({ ok: true, committed: 1, skipped: 0 });
  });

  // The /men/ path is shared by three leagues, so the listing label is the only
  // thing that can say which one a game belongs to.
  it("passes the league from the listing into the resolver", async () => {
    mockDiscover.mockResolvedValue({ games: [listed({ leagueSlug: "bc6" })], errors: [] });
    await handler(mockReq(), mockRes());
    expect(mockScrapeAndResolve).toHaveBeenCalledWith(SOURCE_URL, { leagueSlug: "bc6" });
  });

  it("carries the round from the listing into the commit", async () => {
    mockDiscover.mockResolvedValue({ games: [listed({ round: "semifinal" })], errors: [] });
    await handler(mockReq(), mockRes());
    expect(mockCommitImport.mock.calls[0][0].round).toBe("semifinal");
  });

  it("revalidates ISR paths through the cron response", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    await mockCommitImport.mock.calls[0][1].revalidate("/games");
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
    expect(summary().skipped[0].reason).toBe("league unresolved");
  });

  it("skips an opponent with no known name rather than publishing the source spelling", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ unknownOpponent: "BRAND NEW TEAM" }));
    await handler(mockReq(), mockRes());
    expect(mockCommitImport).not.toHaveBeenCalled();
    expect(summary().skipped[0].reason).toBe('unknown opponent "BRAND NEW TEAM"');
  });

  it("skips when a jersey that played is not on the roster", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ unresolvedPlayers: [{ number: 99, name: "New Guy" }] }));
    await handler(mockReq(), mockRes());
    expect(summary().skipped[0].reason).toBe("player not on roster");
  });

  it("skips a draft the write schema rejects", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ draft: { ...DRAFT, seasonLeagueId: "" } }));
    await handler(mockReq(), mockRes());
    expect(summary().skipped[0].reason).toBe("draft failed schema validation");
  });
});

describe("poll-imports alerting", () => {
  it("emails when a game is stuck on something a person must fix", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ unresolvedPlayers: [{ number: 99, name: "New Guy" }] }));
    await handler(mockReq(), mockRes());
    expect(alert().kind).toBe("stalled");
    expect(alert().entries).toEqual([{ sourceUrl: SOURCE_URL, reason: "player not on roster" }]);
  });

  it("stays quiet while a game is still settling", async () => {
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ gameState: { state: "live", reason: "Q4 open" } }));
    await handler(mockReq(), mockRes());
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("stays quiet when everything committed", async () => {
    await handler(mockReq(), mockRes());
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("stays quiet on a night with nothing new to import", async () => {
    mockDiscover.mockResolvedValue({ games: [], errors: [] });
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockNotify).not.toHaveBeenCalled();
    expect(res.body).toEqual({ ok: true, committed: 0, skipped: 0 });
  });

  // Otherwise a game that never settles drops out of the window unannounced.
  it("emails on the last run that will see a game, even for a settling reason", async () => {
    mockDiscover.mockResolvedValue({ games: [listed({ dateText: LAST_WEEK })], errors: [] });
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ gameState: { state: "live", reason: "Q4 open" } }));
    await handler(mockReq(), mockRes());
    expect(mockNotify).toHaveBeenCalledTimes(1);
    expect(alert().entries[0].reason).toBe("state live");
  });

  it("emails when the run itself throws", async () => {
    mockDiscover.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
    expect(alert()).toEqual({ kind: "stalled", entries: [], error: "boom" });
  });

  it("still finishes the run when the alert cannot be sent", async () => {
    mockNotify.mockRejectedValue(new Error("smtp down"));
    mockScrapeAndResolve.mockResolvedValue(pipelineResult({ unresolved: ["Pick a league."] }));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(mockFinishCronRun).toHaveBeenCalledWith("run1", expect.objectContaining({ ok: true }));
  });
});

describe("poll-imports resilience", () => {
  it("keeps going after one candidate throws", async () => {
    const second = BASE + "SECOND";
    mockDiscover.mockResolvedValue({
      games: [listed(), listed({ gameId: "SECOND", url: second })], errors: [],
    });
    mockScrapeAndResolve
      .mockRejectedValueOnce(new Error("Upstream unreachable"))
      .mockResolvedValueOnce(pipelineResult({ draft: { ...DRAFT, sourceUrl: second } }));

    const res = mockRes();
    await handler(mockReq(), res);

    expect(mockCommitImport).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ ok: true, committed: 1, skipped: 1 });
    expect(summary().skipped[0]).toEqual({ sourceUrl: SOURCE_URL, reason: "Upstream unreachable", transient: false });
  });

  it("records a commit rejection as a skip rather than failing the run", async () => {
    mockCommitImport.mockRejectedValue(new MockCommitError("This game has already been imported.", 409));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(summary().skipped[0].reason).toBe("commit: This game has already been imported.");
  });

  it("returns 500 and marks the run failed when the imported-game lookup throws", async () => {
    mockPrisma.game.findMany.mockRejectedValue(new Error("db down"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
    expect(mockFinishCronRun).toHaveBeenCalledWith("run1", { ok: false, error: "db down" });
  });
});
