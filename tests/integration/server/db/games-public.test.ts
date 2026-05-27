// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/server/db/client", () => ({ default: {}, prisma: {} }));

vi.mock("@/server/db/repositories", () => ({
  getBoxScore: vi.fn(),
}));

import { getBoxScore } from "@/server/db/repositories";
import handler          from "../../../../pages/api/games/[id]";

function mockRes() {
  const res: any = {
    statusCode: 200,
    _headers:   {},
    _body:      undefined,
    setHeader(k: string, v: string) { res._headers[k] = v; return res; },
    status(code: number)            { res.statusCode = code; return res; },
    json(body: unknown)             { res._body = body; return res; },
    end()                           { return res; },
  };
  return res;
}

function mockReq({ method = "GET", query = {}, headers = {} }: any = {}) {
  return { method, query, headers, body: {}, cookies: {} };
}

const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/games/[id]", () => {
  it("returns 400 for an invalid CUID", async () => {
    const req = mockReq({ query: { id: "not-a-cuid" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._body.error).toMatch(/invalid game id/i);
    expect(getBoxScore).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty id", async () => {
    const req = mockReq({ query: { id: "" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for a UUID (not a CUID)", async () => {
    const req = mockReq({ query: { id: "550e8400-e29b-41d4-a716-446655440000" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with boxScore array on success", async () => {
    const mockBoxScore = [
      { pid: "p1", min: 25, pts: 12, reb: 4, orb: 1, drb: 3, ast: 2,
        stl: 1, blk: 0, tov: 1, pf: 2, fgm: 5, fga: 10,
        fg2m: 4, fg2a: 7, fg3m: 1, fg3a: 3, ftm: 1, fta: 2, eff: 10 },
    ];
    (getBoxScore as any).mockResolvedValue(mockBoxScore);

    const req = mockReq({ query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ boxScore: mockBoxScore });
    expect(getBoxScore).toHaveBeenCalledWith(VALID_CUID);
  });

  it("returns 200 with empty boxScore when game has no stats", async () => {
    (getBoxScore as any).mockResolvedValue([]);

    const req = mockReq({ query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._body.boxScore).toEqual([]);
  });

  it("sets Cache-Control header on success", async () => {
    (getBoxScore as any).mockResolvedValue([]);

    const req = mockReq({ query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);

    expect(res._headers["Cache-Control"]).toContain("s-maxage=600");
  });

  it("returns 500 when getBoxScore throws", async () => {
    (getBoxScore as any).mockRejectedValue(new Error("DB connection failed"));

    const req = mockReq({ query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._body).toHaveProperty("error");
  });

  it("does NOT touch loginAttempt on a normal GET", async () => {
    (getBoxScore as any).mockResolvedValue([]);
    const req = mockReq({ query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);
    // Mock db client is empty object -- if handler calls loginAttempt.count/create it throws
    expect(res.statusCode).toBe(200);
  });
});

describe("non-GET methods", () => {
  it("returns 405 for POST", async () => {
    const req = mockReq({ method: "POST", query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns 405 for DELETE", async () => {
    const req = mockReq({ method: "DELETE", query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});
