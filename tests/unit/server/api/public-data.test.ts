// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    loginAttempt: {
      count:  vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/db/repositories", () => ({
  getAllPublicData: vi.fn().mockResolvedValue({ players: [], games: [] }),
}));

import handler from "../../../../pages/api/public/data";

function mockRes() {
  const res: any = {
    statusCode: 200,
    _headers: {},
    _body: undefined,
    setHeader(k: string, v: string) { Reflect.set(res._headers, k, v); return res; },
    status(code: number)            { res.statusCode = code; return res; },
    json(body: unknown)             { res._body = body; return res; },
    end()                           { return res; },
  };
  return res;
}

function mockReq({ method = "GET", headers = {} }: any = {}) {
  return { method, headers, query: {}, body: {}, cookies: {} };
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/public/data", () => {
  it("returns 200 with public data", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ players: [], games: [] });
  });

  it("sets Cache-Control header with s-maxage=60", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res._headers["Cache-Control"]).toContain("s-maxage=60");
  });

  it("does NOT touch loginAttempt on a normal GET", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    expect(mockPrisma.loginAttempt.count).not.toHaveBeenCalled();
    expect(mockPrisma.loginAttempt.create).not.toHaveBeenCalled();
  });

  it("returns 405 for POST", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(405);
  });
});
