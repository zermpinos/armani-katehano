// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    subscriber: { findMany: vi.fn() },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/auth",      () => ({ requireAuth: (h: any) => h }));

import handler from "../../../../pages/api/admin/subscribers/export";

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 0,
    body: null,
    headers,
    setHeader: vi.fn((k: string, v: string) => { headers[k] = v; }),
    status(c: number) { this.statusCode = c; return this; },
    send(b: any)      { this.body = b;       return this; },
    json(b: any)      { this.body = b;       return this; },
    end(b?: any)      { if (b !== undefined) this.body = b; return this; },
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/admin/subscribers/export", () => {
  it("returns 405 for non-GET methods", async () => {
    const res = mockRes();
    await handler({ method: "POST" }, res);
    expect(res.statusCode).toBe(405);
    expect(mockPrisma.subscriber.findMany).not.toHaveBeenCalled();
  });

  it("sets Content-Type: text/csv", async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([]);
    const res = mockRes();
    await handler({ method: "GET" }, res);
    expect(res.headers["Content-Type"]).toBe("text/csv");
  });

  it("sets Content-Disposition to attachment with filename subscribers.csv", async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([]);
    const res = mockRes();
    await handler({ method: "GET" }, res);
    expect(res.headers["Content-Disposition"]).toBe('attachment; filename="subscribers.csv"');
  });

  it("includes the CSV header row", async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([]);
    const res = mockRes();
    await handler({ method: "GET" }, res);
    expect(res.body).toContain("email,createdAt,confirmedAt");
  });

  it("includes one data row per confirmed subscriber", async () => {
    const confirmedAt = new Date("2026-01-15T00:00:00.000Z");
    const createdAt   = new Date("2026-01-01T00:00:00.000Z");
    mockPrisma.subscriber.findMany.mockResolvedValue([
      { email: "a@b.com", createdAt, confirmedAt },
      { email: "c@d.com", createdAt, confirmedAt },
    ]);
    const res = mockRes();
    await handler({ method: "GET" }, res);
    expect(res.body).toContain("a@b.com");
    expect(res.body).toContain("c@d.com");
    expect(res.body).toContain(confirmedAt.toISOString());
  });

  it("returns 200 on success", async () => {
    mockPrisma.subscriber.findMany.mockResolvedValue([]);
    const res = mockRes();
    await handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(200);
  });

  it("returns 500 as plain text on db error", async () => {
    mockPrisma.subscriber.findMany.mockRejectedValue(new Error("boom"));
    const res = mockRes();
    await handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(500);
  });
});
