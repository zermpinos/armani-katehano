import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/server/db/client", () => {
  return {
    default: {
      gameImportJob: {
        findUniqueOrThrow: vi.fn(),
        findUnique:        vi.fn(),
        update:            vi.fn().mockResolvedValue({}),
      },
      game: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (fn: any) => fn({
        $queryRaw: vi.fn().mockResolvedValue([{ id: "job_1" }]),
        gameImportJob: { update: vi.fn().mockResolvedValue({}) },
      })),
    },
  };
});
vi.mock("@/server/services/scrape-game", () => ({ scrapeGameFromUrl: vi.fn(), ScrapeError: class extends Error {} }));
vi.mock("@/server/services/import-game", () => ({ importGame: vi.fn(), ImportError: class extends Error { status?: number } }));

const { sendImportNotification } = vi.hoisted(() => ({
  sendImportNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/integrations/email/client", () => ({ sendImportNotification }));

import prisma from "@/server/db/client";
import { scrapeGameFromUrl } from "@/server/services/scrape-game";
import { importGame } from "@/server/services/import-game";
import { processJob } from "@/server/services/import-job";

function setEnv(playedDaysAgo: number) {
  process.env.BROADCAST_LINK_SECRET   = "a-secret-of-sufficient-length-for-hmac-sha256";
  process.env.BROADCAST_RECENCY_DAYS  = "7";
  process.env.NEXT_PUBLIC_APP_URL     = "https://armani-katehano.com";
  (prisma.game.findUnique as any).mockResolvedValue({
    id: "game_1",
    playedOn: new Date(Date.now() - playedDaysAgo * 24 * 60 * 60 * 1000),
  });
  (prisma.gameImportJob.findUnique as any).mockResolvedValue({ importedGameId: "game_1" });
  (scrapeGameFromUrl as any).mockResolvedValue({
    data: {},
    gameState: { state: "final" },
  });
  (importGame as any).mockResolvedValue({ gameId: "game_1" });
  (prisma.gameImportJob.findUniqueOrThrow as any).mockResolvedValue({
    id: "job_1",
    successSentAt: null,
    importedGameId: "game_1",
    sourceUrl: "https://example.com/x",
    attempts: 0,
    upcomingGame: { opponent: "Opp", location: "home", scheduledFor: new Date("2026-05-15T19:00:00Z") },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifySuccess token mint conditions", () => {
  it("includes broadcastLink when playedOn is within recency window and envs are set", async () => {
    setEnv(2);
    await processJob("job_1");
    const call = sendImportNotification.mock.calls.find(c => c[0].kind === "success");
    expect(call).toBeDefined();
    expect(call![0].broadcastLink).toMatch(/\/api\/admin\/import-jobs\/broadcast\?token=/);
  });

  it("omits broadcastLink when playedOn is outside recency window", async () => {
    setEnv(30);
    await processJob("job_1");
    const call = sendImportNotification.mock.calls.find(c => c[0].kind === "success");
    expect(call).toBeDefined();
    expect(call![0].broadcastLink).toBeUndefined();
  });

  it("omits broadcastLink when BROADCAST_LINK_SECRET is missing", async () => {
    setEnv(2);
    delete process.env.BROADCAST_LINK_SECRET;
    await processJob("job_1");
    const call = sendImportNotification.mock.calls.find(c => c[0].kind === "success");
    expect(call![0].broadcastLink).toBeUndefined();
  });

  it("omits broadcastLink when importedGameId is null (409 conflict path)", async () => {
    setEnv(2);
    (prisma.gameImportJob.findUniqueOrThrow as any).mockResolvedValue({
      id: "job_1", successSentAt: null, importedGameId: null,
      sourceUrl: "https://example.com/x", attempts: 0,
      upcomingGame: { opponent: "Opp", location: "home", scheduledFor: new Date() },
    });
    (prisma.gameImportJob.findUnique as any).mockResolvedValue({ importedGameId: null });
    (importGame as any).mockRejectedValue(Object.assign(new Error("dup"), { status: 409, gameId: null }));
    await processJob("job_1");
    const call = sendImportNotification.mock.calls.find(c => c[0].kind === "success");
    if (call) expect(call[0].broadcastLink).toBeUndefined();
  });
});
