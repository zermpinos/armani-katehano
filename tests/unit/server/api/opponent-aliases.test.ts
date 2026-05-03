// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    opponentAlias: {
      findMany: vi.fn(),
      create:   vi.fn(),
      update:   vi.fn(),
      delete:   vi.fn(),
    },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/auth", () => ({
  requireAuth: (h: any) => h,
  validateAdminSlug: () => true,
}));
vi.mock("@/server/security/node", () => ({
  auditLog:    vi.fn(),
  getClientIp: () => "1.1.1.1",
}));

import handler from "../../../../pages/api/admin/opponent-aliases/[[...params]]";

function mockReq(o: any = {}) {
  return {
    method:  o.method ?? "GET",
    headers: { authorization: "Bearer admin" },
    body:    o.body,
    query:   o.query ?? {},
  };
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
  mockPrisma.opponentAlias.findMany.mockResolvedValue([]);
});

describe("GET /api/admin/opponent-aliases", () => {
  it("lists aliases ordered by myName", async () => {
    mockPrisma.opponentAlias.findMany.mockResolvedValue([
      { id: "a1", myName: "Παναθηναϊκός", listingName: "ΠΑΟ", notes: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const res = mockRes();
    await handler(mockReq({ method: "GET", query: { params: [] } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ aliases: [{ myName: "Παναθηναϊκός", listingName: "ΠΑΟ" }] });
  });
});

describe("POST /api/admin/opponent-aliases", () => {
  it("creates an alias", async () => {
    mockPrisma.opponentAlias.create.mockResolvedValue({ id: "a1" });
    const res = mockRes();
    await handler(mockReq({
      method: "POST",
      query:  { params: [] },
      body:   { myName: "Παναθηναϊκός", listingName: "ΠΑΟ" },
    }), res);
    expect(res.statusCode).toBe(201);
    expect(mockPrisma.opponentAlias.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ myName: "Παναθηναϊκός", listingName: "ΠΑΟ" }),
    });
  });

  it("rejects empty myName", async () => {
    const res = mockRes();
    await handler(mockReq({
      method: "POST",
      query:  { params: [] },
      body:   { myName: "", listingName: "ΠΑΟ" },
    }), res);
    expect(res.statusCode).toBe(400);
  });
});

describe("PUT /api/admin/opponent-aliases", () => {
  it("updates an alias", async () => {
    mockPrisma.opponentAlias.update.mockResolvedValue({});
    const res = mockRes();
    await handler(mockReq({
      method: "PUT",
      query:  { params: [] },
      body:   { id: "ckabcdefghijklmnopqrstuv", myName: "X", listingName: "Y" },
    }), res);
    expect(res.statusCode).toBe(200);
  });
});

describe("DELETE /api/admin/opponent-aliases", () => {
  it("deletes an alias", async () => {
    mockPrisma.opponentAlias.delete.mockResolvedValue({});
    const res = mockRes();
    await handler(mockReq({
      method: "DELETE",
      query:  { params: [] },
      body:   { id: "ckabcdefghijklmnopqrstuv" },
    }), res);
    expect(res.statusCode).toBe(200);
  });
});
