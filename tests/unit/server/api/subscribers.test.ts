// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscriber: {
      count:      vi.fn(),
      findMany:   vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/auth",      () => ({ requireAuth: (h: any) => h }));

import handler from "../../../../pages/api/admin/subscribers";

function mockReq(overrides: any = {}) {
  return {
    method: overrides.method ?? "GET",
    query:  overrides.query  ?? {},
    body:   overrides.body   ?? {},
  };
}

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    status(c: number) { this.statusCode = c; return this; },
    json(b: any)      { this.body = b;       return this; },
    end()             { return this; },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.subscriber.count.mockResolvedValue(0);
  mockPrisma.subscriber.findMany.mockResolvedValue([]);
});

describe("GET /api/admin/subscribers — defaults and pagination", () => {
  it("returns 200 with default page/limit when no query params given", async () => {
    mockPrisma.subscriber.count.mockResolvedValue(3);
    mockPrisma.subscriber.findMany.mockResolvedValue([
      { id: "cl1", email: "a@b.com", createdAt: new Date(), confirmedAt: new Date() },
    ]);
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(50);
    expect(res.body.total).toBe(3);
    expect(res.body.subscribers).toHaveLength(1);
  });

  it("returns 400 when limit > 200", async () => {
    const res = mockRes();
    await handler(mockReq({ query: { limit: "201" } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.subscriber.findMany).not.toHaveBeenCalled();
  });

  it("returns 400 when limit < 1", async () => {
    const res = mockRes();
    await handler(mockReq({ query: { limit: "0" } }), res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for an unrecognised status value", async () => {
    const res = mockRes();
    await handler(mockReq({ query: { status: "bogus" } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.subscriber.findMany).not.toHaveBeenCalled();
  });

  it("sets hasMore true when rows beyond the current page exist", async () => {
    mockPrisma.subscriber.count.mockResolvedValue(100);
    mockPrisma.subscriber.findMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({
        id: `cl${i}`, email: `u${i}@x.com`, createdAt: new Date(), confirmedAt: new Date(),
      }))
    );
    const res = mockRes();
    await handler(mockReq({ query: { page: "1", limit: "50" } }), res);
    expect(res.body.hasMore).toBe(true);
  });

  it("sets hasMore false on the final page", async () => {
    mockPrisma.subscriber.count.mockResolvedValue(10);
    mockPrisma.subscriber.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        id: `cl${i}`, email: `u${i}@x.com`, createdAt: new Date(), confirmedAt: new Date(),
      }))
    );
    const res = mockRes();
    await handler(mockReq({ query: { page: "1", limit: "50" } }), res);
    expect(res.body.hasMore).toBe(false);
  });

  it("passes search string to prisma as an insensitive email contains filter", async () => {
    const res = mockRes();
    await handler(mockReq({ query: { search: "alice" } }), res);
    const args = mockPrisma.subscriber.findMany.mock.calls[0][0];
    expect(args.where.email).toEqual({ contains: "alice", mode: "insensitive" });
  });

  it("filters confirmed-only by default", async () => {
    const res = mockRes();
    await handler(mockReq(), res);
    const args = mockPrisma.subscriber.findMany.mock.calls[0][0];
    expect(args.where.confirmedAt).toEqual({ not: null });
  });

  it("sets confirmedAt to null when status=unconfirmed", async () => {
    const res = mockRes();
    await handler(mockReq({ query: { status: "unconfirmed" } }), res);
    const args = mockPrisma.subscriber.findMany.mock.calls[0][0];
    expect(args.where.confirmedAt).toBeNull();
  });

  it("omits confirmedAt filter when status=all", async () => {
    const res = mockRes();
    await handler(mockReq({ query: { status: "all" } }), res);
    const args = mockPrisma.subscriber.findMany.mock.calls[0][0];
    expect(args.where.confirmedAt).toBeUndefined();
  });

  it("returns 500 on db error", async () => {
    mockPrisma.subscriber.findMany.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler(mockReq(), res);
    expect(res.statusCode).toBe(500);
  });
});

describe("DELETE /api/admin/subscribers — bulk delete", () => {
  it("returns 400 when ids is missing from body", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "DELETE", body: {} }), res);
    expect(res.statusCode).toBe(400);
    expect(mockPrisma.subscriber.deleteMany).not.toHaveBeenCalled();
  });

  it("returns 400 when ids is an empty array", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "DELETE", body: { ids: [] } }), res);
    expect(res.statusCode).toBe(400);
  });

  it("deletes by id array and returns the deleted count", async () => {
    mockPrisma.subscriber.deleteMany.mockResolvedValue({ count: 2 });
    const res = mockRes();
    await handler(mockReq({ method: "DELETE", body: { ids: ["cl1", "cl2"] } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deleted: 2 });
    expect(mockPrisma.subscriber.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["cl1", "cl2"] } },
    });
  });

  it("returns deleted: 0 when none of the ids exist (silent no-op)", async () => {
    mockPrisma.subscriber.deleteMany.mockResolvedValue({ count: 0 });
    const res = mockRes();
    await handler(mockReq({ method: "DELETE", body: { ids: ["nonexistent"] } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ deleted: 0 });
  });

  it("returns 500 on db error", async () => {
    mockPrisma.subscriber.deleteMany.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler(mockReq({ method: "DELETE", body: { ids: ["cl1"] } }), res);
    expect(res.statusCode).toBe(500);
  });
});
