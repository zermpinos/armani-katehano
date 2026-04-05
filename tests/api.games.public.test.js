/**
 * tests/api.games.public.test.js
 * Integration tests for pages/api/games/[id].js
 *
 * Public endpoint — no auth. Tests CUID validation and getBoxScore response shaping.
 * Mocks: lib/data (getBoxScore) so no DB is needed.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../lib/data", () => ({
  getBoxScore: vi.fn(),
}));

import { getBoxScore } from "../lib/data";
import handler          from "../pages/api/games/[id].js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockRes() {
  const res = {
    statusCode: 200,
    _headers:   {},
    _body:      undefined,
    setHeader(k, v) { res._headers[k] = v; return res; },
    status(code)    { res.statusCode = code; return res; },
    json(body)      { res._body = body; return res; },
    end()           { return res; },
  };
  return res;
}

function mockReq({ method = "GET", query = {}, headers = {} } = {}) {
  return { method, query, headers, body: {}, cookies: {} };
}

const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxx";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

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
    getBoxScore.mockResolvedValue(mockBoxScore);

    const req = mockReq({ query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._body).toEqual({ boxScore: mockBoxScore });
    expect(getBoxScore).toHaveBeenCalledWith(VALID_CUID);
  });

  it("returns 200 with empty boxScore when game has no stats", async () => {
    getBoxScore.mockResolvedValue([]);

    const req = mockReq({ query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._body.boxScore).toEqual([]);
  });

  it("sets Cache-Control header on success", async () => {
    getBoxScore.mockResolvedValue([]);

    const req = mockReq({ query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);

    expect(res._headers["Cache-Control"]).toContain("s-maxage=600");
  });

  it("returns 500 when getBoxScore throws", async () => {
    getBoxScore.mockRejectedValue(new Error("DB connection failed"));

    const req = mockReq({ query: { id: VALID_CUID } });
    const res = mockRes();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res._body).toHaveProperty("error");
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
