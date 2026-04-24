// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma, mockTx } = vi.hoisted(() => {
  const tx = {
    $queryRaw:      vi.fn(),
    gameImportJob:  { update: vi.fn() },
  };
  const mp = {
    gameImportJob: {
      findUniqueOrThrow: vi.fn(),
      update:            vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (fn) => fn(tx)),
  };
  return { mockPrisma: mp, mockTx: tx };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));

vi.mock("@/server/services/scrape-game", () => ({
  scrapeGameFromUrl: vi.fn(),
  ScrapeError: class ScrapeError extends Error {
    constructor(msg: string, public status: number) { super(msg); this.name = "ScrapeError"; }
  },
}));

vi.mock("@/server/services/import-game", () => ({
  importGame: vi.fn(),
  ImportError: class ImportError extends Error {
    constructor(msg: string, public status: number, public extra?: any) { super(msg); this.name = "ImportError"; }
  },
}));

import { processJob }        from "@/server/services/import-job";
import { scrapeGameFromUrl } from "@/server/services/scrape-game";
import { importGame }        from "@/server/services/import-game";

const FINAL_GAME_STATE = { state: "final", reason: "all 4 quarters complete with consistent final score" };
const LIVE_GAME_STATE  = { state: "live",  reason: "fewer than 4 quarters recorded" };

const PENDING_JOB = {
  id:            "job1",
  upcomingGameId:"ug1",
  sourceUrl:     "https://basketcity.sportstats.gr/game/123",
  state:         "PENDING",
  attempts:      1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTx.gameImportJob.update.mockResolvedValue({});
  mockPrisma.gameImportJob.update.mockResolvedValue({});
});

describe("processJob", () => {
  it("happy path — scrapes final game and settles job as IMPORTED", async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: "job1" }]);
    mockPrisma.gameImportJob.findUniqueOrThrow.mockResolvedValue(PENDING_JOB);
    vi.mocked(scrapeGameFromUrl).mockResolvedValue({ data: { game: {}, teams: [] }, gameState: FINAL_GAME_STATE });
    vi.mocked(importGame).mockResolvedValue({ gameId: "game1", playersImported: 5, skipped: [] });

    await processJob("job1");

    expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job1" },
        data: expect.objectContaining({ state: "IMPORTED", importedGameId: "game1" }),
      })
    );
  });

  it("lock skip — returns without scraping when another worker holds the lock", async () => {
    mockTx.$queryRaw.mockResolvedValue([]); // SKIP LOCKED returned nothing

    await processJob("job1");

    expect(mockPrisma.gameImportJob.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(scrapeGameFromUrl).not.toHaveBeenCalled();
  });

  it("manual-import collision — settles job as IMPORTED with existing gameId on 409", async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: "job1" }]);
    mockPrisma.gameImportJob.findUniqueOrThrow.mockResolvedValue(PENDING_JOB);
    vi.mocked(scrapeGameFromUrl).mockResolvedValue({ data: { game: {}, teams: [] }, gameState: FINAL_GAME_STATE });

    const { ImportError } = await import("@/server/services/import-game");
    const collision = Object.assign(new ImportError("already imported", 409), { gameId: "existing-game" });
    vi.mocked(importGame).mockRejectedValue(collision);

    await processJob("job1");

    expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job1" },
        data: expect.objectContaining({ state: "IMPORTED", importedGameId: "existing-game" }),
      })
    );
  });

  it("retry-cap — moves job to ERROR when attempts reach MAX_ATTEMPTS and page is still not final", async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: "job1" }]);
    mockPrisma.gameImportJob.findUniqueOrThrow.mockResolvedValue({ ...PENDING_JOB, attempts: 3 });
    vi.mocked(scrapeGameFromUrl).mockResolvedValue({ data: { game: {}, teams: [] }, gameState: LIVE_GAME_STATE });

    await processJob("job1");

    expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job1" },
        data: expect.objectContaining({ state: "ERROR" }),
      })
    );
  });
});
