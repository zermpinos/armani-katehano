// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma, mockScrape } = vi.hoisted(() => ({
  mockPrisma: {
    player:       { findMany: vi.fn() },
    seasonLeague: { findMany: vi.fn() },
  },
  mockScrape: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/services/scrape-game", () => ({
  scrapeGameFromUrl: mockScrape,
  ScrapeError: class ScrapeError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  },
}));
vi.mock("@/server/services/import-commit", () => ({ captureImportDraft: vi.fn() }));

import { scrapeAndResolve } from "@/server/services/import-pipeline";

// The shape production is in right now: no season carries dates, last season
// archived, next season live. With no end date every season covers every date,
// and with no start date the newest-first sort has nothing to order on, so the
// archive flag is all that keeps a September game out of last season.
const ARCHIVED = {
  id: "sl-2025", league: { slug: "rookie" },
  season: { startDate: null, endDate: null, archivedAt: new Date("2026-07-17") },
};
const LIVE = {
  id: "sl-2026", league: { slug: "rookie" },
  season: { startDate: null, endDate: null, archivedAt: null },
};

function boxScore() {
  return {
    game: {
      homeTeam: "ARMANI KATEHANO", awayTeam: "Rivals",
      date: "Σάββατο, 12 Σεπτεμβρίου 2026",
      finalScore: { home: 60, away: 55 },
    },
    teams: [
      { name: "ARMANI KATEHANO", players: [{ "#": 4, Players: "On Roster", MIN: "20:00", PTS: 10 }] },
      { name: "Rivals", players: [] },
    ],
    url: "https://example.com/rookie/gamedetails/id/ABC",
  };
}

// Honours the where clause so the assertion is about behaviour, not the query.
function seasonLeaguesIn(rows) {
  mockPrisma.seasonLeague.findMany.mockImplementation(({ where } = {}) =>
    Promise.resolve(where?.season?.archivedAt === null ? rows.filter(r => !r.season.archivedAt) : rows),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.player.findMany.mockResolvedValue([{ id: "p1", number: 4 }]);
  mockScrape.mockResolvedValue({ data: boxScore(), gameState: "final", bytesHash: "h" });
});

describe("scrapeAndResolve season selection", () => {
  it("picks the live season, not the archived one that also covers the date", async () => {
    seasonLeaguesIn([ARCHIVED, LIVE]);
    const { draft, unresolved } = await scrapeAndResolve("https://example.com/rookie/gamedetails/id/ABC");
    expect(draft.seasonLeagueId).toBe("sl-2026");
    expect(unresolved).toHaveLength(0);
  });

  it("leaves the season unresolved rather than importing into an archived one", async () => {
    seasonLeaguesIn([ARCHIVED]);
    const { draft, unresolved } = await scrapeAndResolve("https://example.com/rookie/gamedetails/id/ABC");
    expect(draft.seasonLeagueId).toBe("");
    expect(unresolved.join(" ")).toMatch(/rookie/);
  });
});
