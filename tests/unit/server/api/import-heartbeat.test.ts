// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    cronRun:      { findMany: vi.fn() },
    upcomingGame: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/integrations/email/client", () => ({
  sendImportHeartbeat: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/server/security/edge", () => ({ securityHeaders: () => ({ "X-Test": "1" }) }));
vi.mock("@/server/security/node",  () => ({ auditLog: vi.fn() }));

import handler from "../../../../pages/api/cron/import-heartbeat";
import { sendImportHeartbeat } from "@/server/integrations/email/client";

const NOW = new Date("2026-05-01T05:05:00Z");

function mockReq(o: any = {}) {
  return { method: o.method ?? "GET", headers: o.headers ?? { authorization: "Bearer test-secret" } };
}
function mockRes() {
  return {
    statusCode: 0, body: null,
    setHeader: vi.fn(),
    status(c: number) { this.statusCode = c; return this; },
    json(b: any)      { this.body = b;       return this; },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = "test-secret";
  mockPrisma.cronRun.findMany.mockResolvedValue([]);
  mockPrisma.upcomingGame.findMany.mockResolvedValue([]);
});

describe("import-heartbeat auth", () => {
  it("returns 401 without bearer", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
  });
});

describe("import-heartbeat content", () => {
  it("upcomingNext7d query excludes IMPORTED rows", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    // calls[0]=inWindow, calls[1]=dropouts, calls[2]=upcomingNext7d
    const next7dArgs = mockPrisma.upcomingGame.findMany.mock.calls[2][0];
    expect(next7dArgs.where).toEqual({
      scheduledFor: { gte: expect.any(Date), lte: expect.any(Date) },
      OR: [
        { importJob: null },
        { importJob: { isNot: { state: "IMPORTED" } } },
      ],
    });
  });

  it("sends an email with runs, in-window, dropouts and next-7-days sections", async () => {
    mockPrisma.cronRun.findMany.mockResolvedValue([
      { id: "r1", job: "discover-and-import", startedAt: new Date(NOW.getTime() - 3600_000), ok: true, summary: { candidates: 1, imported: 1 }, error: null, finishedAt: new Date() },
    ]);
    mockPrisma.upcomingGame.findMany
      .mockResolvedValueOnce([
        {
          id: "g1", opponent: "Παναθηναϊκός",
          scheduledFor: new Date(NOW.getTime() - 3 * 24 * 3600_000),
          listingUrl: "x", importJob: { state: "PENDING", attempts: 1, lastError: "no row yet" },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "g2", opponent: "AEK",
          scheduledFor: new Date(NOW.getTime() - 10 * 24 * 3600_000),
          listingUrl: null, importJob: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "g3", opponent: "ΟΣΦΠ",
          scheduledFor: new Date(NOW.getTime() + 3 * 24 * 3600_000),
          listingUrl: null, importJob: null,
        },
      ]);

    const res = mockRes();
    await handler(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(sendImportHeartbeat).toHaveBeenCalledWith(expect.objectContaining({
      runs:           expect.arrayContaining([expect.objectContaining({ ok: true })]),
      inWindow:       expect.arrayContaining([expect.objectContaining({ opponent: "Παναθηναϊκός" })]),
      dropouts:       expect.arrayContaining([expect.objectContaining({ opponent: "AEK" })]),
      upcomingNext7d: expect.arrayContaining([expect.objectContaining({ opponent: "ΟΣΦΠ", hasListing: false })]),
    }));
  });
});
