// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-seasons-archive";
});

const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    season: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
  };
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));

import archiveHandler   from "../../../../../pages/api/admin/seasons/[id]/archive";
import unarchiveHandler from "../../../../../pages/api/admin/seasons/[id]/unarchive";
import { authedReq, mockRes, mockResWithRevalidate, mockReq } from "../../db/__support__/games-admin-mocks";

const LIVE_SEASON = {
  id: "s1",
  name: "2025-26",
  year: 2025,
  startDate: null,
  endDate: null,
  archivedAt: null,
  createdAt: new Date("2025-08-01"),
};
const ARCHIVED_SEASON = { ...LIVE_SEASON, archivedAt: new Date("2026-07-09") };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/seasons/[id]/archive", () => {
  it("sets archivedAt on a live season", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(LIVE_SEASON);
    mockPrisma.season.update.mockResolvedValue(ARCHIVED_SEASON);
    const req = authedReq({ method: "POST", query: { id: "s1" } });
    const res = mockResWithRevalidate();
    await archiveHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.season.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: expect.objectContaining({ archivedAt: expect.any(Date) }),
      })
    );
  });

  it("is idempotent when already archived (no update call)", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(ARCHIVED_SEASON);
    const req = authedReq({ method: "POST", query: { id: "s1" } });
    const res = mockResWithRevalidate();
    await archiveHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.alreadyArchived).toBe(true);
    expect(mockPrisma.season.update).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown season id", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(null);
    const req = authedReq({ method: "POST", query: { id: "nope" } });
    const res = mockRes();
    await archiveHandler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("returns 405 for non-POST", async () => {
    const req = authedReq({ method: "GET", query: { id: "s1" } });
    const res = mockRes();
    await archiveHandler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it("returns 403 without auth (CSRF blocked)", async () => {
    const req = mockReq({ method: "POST", query: { id: "s1" } });
    const res = mockRes();
    await archiveHandler(req, res);
    expect(res.statusCode).toBe(403);
  });

  it("calls revalidate for stat listings after archive", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(LIVE_SEASON);
    mockPrisma.season.update.mockResolvedValue(ARCHIVED_SEASON);
    const req = authedReq({ method: "POST", query: { id: "s1" } });
    const res = mockResWithRevalidate();
    await archiveHandler(req, res);
    expect(res.revalidate).toHaveBeenCalledWith("/leaderboard");
    expect(res.revalidate).toHaveBeenCalledWith("/team-stats");
  });
});

describe("POST /api/admin/seasons/[id]/unarchive", () => {
  it("clears archivedAt on an archived season", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(ARCHIVED_SEASON);
    mockPrisma.season.update.mockResolvedValue(LIVE_SEASON);
    const req = authedReq({ method: "POST", query: { id: "s1" } });
    const res = mockResWithRevalidate();
    await unarchiveHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockPrisma.season.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "s1" },
        data: { archivedAt: null },
      })
    );
  });

  it("is idempotent when already live (no update call)", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(LIVE_SEASON);
    const req = authedReq({ method: "POST", query: { id: "s1" } });
    const res = mockResWithRevalidate();
    await unarchiveHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._body.alreadyLive).toBe(true);
    expect(mockPrisma.season.update).not.toHaveBeenCalled();
  });

  it("returns 404 for unknown season id", async () => {
    mockPrisma.season.findUnique.mockResolvedValue(null);
    const req = authedReq({ method: "POST", query: { id: "nope" } });
    const res = mockRes();
    await unarchiveHandler(req, res);
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 without auth (CSRF blocked)", async () => {
    const req = mockReq({ method: "POST", query: { id: "s1" } });
    const res = mockRes();
    await unarchiveHandler(req, res);
    expect(res.statusCode).toBe(403);
  });
});
