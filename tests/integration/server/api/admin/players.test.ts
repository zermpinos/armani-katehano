// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-players";
});

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: { player: { findMany: vi.fn() } },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));

import handler from "../../../../../pages/api/admin/players";
import { authedReq, mockResWithRevalidate } from "../../db/__support__/games-admin-mocks";

const whereOfFirstCall = () => mockPrisma.player.findMany.mock.calls[0][0].where;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.player.findMany.mockResolvedValue([]);
});

describe("GET /api/admin/players", () => {
  it("lists only active players by default, which the import flow relies on", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(200);
    expect(whereOfFirstCall()).toEqual({ isActive: true });
  });

  it("includes retired players with ?all=1", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "GET", query: { all: "1" } }), res);
    expect(res.statusCode).toBe(200);
    expect(whereOfFirstCall()).toEqual({});
  });

  it("treats any other value of all as the default", async () => {
    const res = mockResWithRevalidate();
    await handler(authedReq({ method: "GET", query: { all: "yes" } }), res);
    expect(whereOfFirstCall()).toEqual({ isActive: true });
  });
});
