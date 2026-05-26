// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-season-phase";
});

const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    setting: {
      findUnique: vi.fn(),
      upsert:     vi.fn(),
    },
  };
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));

import handler from "../../../../../pages/api/admin/season-phase";
import { mockRes, mockResWithRevalidate, authedReq, mockReq } from "../../db/__support__/games-admin-mocks";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.setting.findUnique.mockResolvedValue({ key: "seasonPhase", value: "regular" });
  mockPrisma.setting.upsert.mockResolvedValue({ key: "seasonPhase", value: "semifinal" });
});

describe("GET /api/admin/season-phase", () => {
  it("returns current seasonPhase", async () => {
    const req = authedReq({ method: "GET" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.seasonPhase).toBe("regular");
  });

  it("returns 'regular' when setting is absent", async () => {
    mockPrisma.setting.findUnique.mockResolvedValue(null);
    const req = authedReq({ method: "GET" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.seasonPhase).toBe("regular");
  });

  it("returns 405 for disallowed methods", async () => {
    const req = authedReq({ method: "PATCH" });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

describe("POST /api/admin/season-phase", () => {
  it("returns 400 for invalid phase value", async () => {
    const req = authedReq({ method: "POST", body: { phase: "banana" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it("upserts the setting and returns updated seasonPhase", async () => {
    const req = authedReq({ method: "POST", body: { phase: "semifinal" } });
    const res = mockResWithRevalidate();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.seasonPhase).toBe("semifinal");
    expect(mockPrisma.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where:  { key: "seasonPhase" },
        update: { value: "semifinal" },
        create: { key: "seasonPhase", value: "semifinal" },
      })
    );
  });

  it("calls revalidate for / and /games after upsert", async () => {
    const req = authedReq({ method: "POST", body: { phase: "final" } });
    const res = mockResWithRevalidate();
    await handler(req, res);
    expect(res.revalidate).toHaveBeenCalledWith("/");
    expect(res.revalidate).toHaveBeenCalledWith("/games");
  });

  it("returns 403 without auth (CSRF blocked)", async () => {
    const req = mockReq({ method: "POST", body: { phase: "semifinal" } });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
  });
});
