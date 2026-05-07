// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    upcomingGame: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/auth", () => ({
  requireCoachAuth: (h: any) => h,
}));
vi.mock("@/domain/shared/format", () => ({
  prodError: (e: Error) => e.message,
}));

import handler from "../../../../pages/api/coach/schedule";

const NOW = new Date("2026-05-07T10:00:00Z");

function mockReq(method = "GET") {
  return { method, headers: {} };
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
  mockPrisma.upcomingGame.findMany.mockResolvedValue([]);
});

describe("coach schedule API", () => {
  it("rejects non-GET", async () => {
    const res = mockRes();
    await handler(mockReq("POST"), res);
    expect(res.statusCode).toBe(405);
  });

  it("filters out past games — only fetches scheduledFor >= now", async () => {
    await handler(mockReq(), mockRes());
    expect(mockPrisma.upcomingGame.findMany).toHaveBeenCalledTimes(1);
    const call = mockPrisma.upcomingGame.findMany.mock.calls[0][0];
    expect(call.where).toEqual({ scheduledFor: { gte: NOW } });
    expect(call.orderBy).toEqual({ scheduledFor: "asc" });
  });

  it("returns the schedule on success", async () => {
    const games = [{ id: "g1", opponent: "X", scheduledFor: new Date("2026-05-10T19:00:00Z") }];
    mockPrisma.upcomingGame.findMany.mockResolvedValue(games);
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.schedule).toEqual(games);
  });

  it("returns 500 on db error", async () => {
    mockPrisma.upcomingGame.findMany.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });
});
