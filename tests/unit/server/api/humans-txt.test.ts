// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DEVELOPER_NAME, DEVELOPER_PORTFOLIO, SITE_NAME } from "@/domain/shared/constants";

import handler from "../../../../pages/api/humans-txt";

function mockRes() {
  const headers = new Map<string, string>();
  return {
    statusCode: 0,
    body: null,
    headers,
    setHeader: vi.fn((k: string, v: string) => { headers.set(k, v); }),
    status(c: number) { this.statusCode = c; return this; },
    send(b: any)      { this.body = b;       return this; },
    json(b: any)      { this.body = b;       return this; },
    end(b?: any)      { if (b !== undefined) this.body = b; return this; },
  } as any;
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/humans-txt", () => {
  it("returns 405 for non-GET requests", async () => {
    const res = mockRes();
    await handler({ method: "POST" } as any, res);
    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: "Method not allowed" });
  });

  it("sets Content-Type to text/plain", async () => {
    const res = mockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  });

  it("includes developer name in response body", async () => {
    const res = mockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body).toContain(DEVELOPER_NAME);
  });

  it("includes portfolio URL in response body", async () => {
    const res = mockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body).toContain(DEVELOPER_PORTFOLIO);
  });

  it("includes site name in response body", async () => {
    const res = mockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.body).toContain(SITE_NAME);
  });

  it("returns 200 status", async () => {
    const res = mockRes();
    await handler({ method: "GET" } as any, res);
    expect(res.statusCode).toBe(200);
  });
});
