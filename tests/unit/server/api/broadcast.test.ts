import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";

vi.mock("@/server/auth", () => ({
  requireAuth: (handler: any) => handler,
}));

vi.mock("@/server/db/client", () => ({
  default: {
    broadcastLog: {
      findFirst: vi.fn(),
      count:     vi.fn(),
      create:    vi.fn(),
      findMany:  vi.fn(),
    },
    subscriber: {
      findMany:   vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));
vi.mock("@/server/security/node/client-ip",  () => ({ getClientIp: () => "127.0.0.1" }));
vi.mock("@/server/security/edge/headers",    () => ({ securityHeaders: () => ({}) }));

const mockSendMail = vi.fn().mockResolvedValue({});
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
  createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
}));

beforeAll(() => {
  process.env.BREVO_SMTP_USER     = "test-user";
  process.env.BREVO_SMTP_PASS     = "test-pass";
  process.env.ADMIN_ALERT_EMAIL   = "admin@test.com";
  process.env.NEXT_PUBLIC_APP_URL = "https://test.com";
});

import prisma from "@/server/db/client";
import handler from "@/pages/api/admin/broadcast";

function makeReq(method: string, body: any = {}, query: any = {}): any {
  return { method, body, query, cookies: {}, headers: {} };
}
function makeRes(): any {
  const res: any = { _headers: {} };
  res.status    = (code: number) => { res._status = code; return res; };
  res.json      = (data: any)    => { res._body = data; return res; };
  res.setHeader = (_k: string, _v: string) => {};
  return res;
}

beforeEach(() => { vi.clearAllMocks(); });

describe("GET /api/admin/broadcast", () => {
  it("returns broadcast history", async () => {
    (prisma.broadcastLog.findMany as any).mockResolvedValue([
      { id: "1", subject: "Hi", recipientCount: 10, deliveredCount: 10, failedCount: 0, sentAt: new Date(), sentToAll: true },
    ]);
    (prisma.broadcastLog.count as any).mockResolvedValue(1);
    const req = makeReq("GET", {}, { limit: "20" });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._body.logs).toHaveLength(1);
    expect(res._body.total).toBe(1);
  });
  it("returns 405 for unsupported method", async () => {
    const req = makeReq("PUT");
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });
});

describe("POST mode=resolve", () => {
  it("returns matched and unmatched counts", async () => {
    (prisma.subscriber.findMany as any).mockResolvedValue([
      { id: "s1", email: "matched@example.com" },
    ]);
    const req = makeReq("POST", { mode: "resolve", targetEmails: ["matched@example.com", "unknown@example.com"] });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._body.matched).toBe(1);
    expect(res._body.unmatchedCount).toBe(1);
    expect(res._body.unmatched).toContain("unknown@example.com");
  });
  it("filters to confirmedAt not null in the DB query", async () => {
    (prisma.subscriber.findMany as any).mockResolvedValue([]);
    const req = makeReq("POST", { mode: "resolve", targetEmails: ["a@b.com"] });
    const res = makeRes();
    await handler(req, res);
    const call = (prisma.subscriber.findMany as any).mock.calls[0][0];
    expect(call.where.confirmedAt).toEqual({ not: null });
  });
});

describe("POST mode=send - double-send guard", () => {
  it("returns 429 if a send happened within the last 120 seconds", async () => {
    (prisma.broadcastLog.findFirst as any).mockResolvedValue({ id: "recent" });
    const req = makeReq("POST", { mode: "send", subject: "Hi", body: "Hello" });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(429);
  });
});

describe("POST mode=send - daily cap", () => {
  it("returns 429 if 5 or more sends happened in the last 24 hours", async () => {
    (prisma.broadcastLog.findFirst as any).mockResolvedValue(null);
    (prisma.broadcastLog.count as any).mockResolvedValue(5);
    const req = makeReq("POST", { mode: "send", subject: "Hi", body: "Hello" });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(429);
    expect(res._body.error).toContain("Daily broadcast limit");
  });
});

describe("POST mode=send - recipient filtering", () => {
  beforeEach(() => {
    (prisma.broadcastLog.findFirst as any).mockResolvedValue(null);
    (prisma.broadcastLog.count   as any).mockResolvedValue(0);
    (prisma.broadcastLog.create  as any).mockResolvedValue({});
    (prisma.subscriber.updateMany as any).mockResolvedValue({});
  });
  it("returns 400 when no confirmed subscribers match", async () => {
    (prisma.subscriber.findMany as any).mockResolvedValue([]);
    const req = makeReq("POST", { mode: "send", subject: "Hi", body: "Hello", targetEmails: ["nobody@example.com"] });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toContain("No confirmed subscribers");
  });
  it("always filters to confirmedAt not null even for targetEmails", async () => {
    (prisma.subscriber.findMany as any).mockResolvedValue([
      { id: "s1", email: "ok@example.com", token: "tok1" },
    ]);
    const req = makeReq("POST", { mode: "send", subject: "Hi", body: "Hello", targetEmails: ["ok@example.com", "unconfirmed@example.com"] });
    const res = makeRes();
    await handler(req, res);
    const call = (prisma.subscriber.findMany as any).mock.calls[0][0];
    expect(call.where.confirmedAt).toEqual({ not: null });
  });
  it("succeeds and returns delivered/failed counts", async () => {
    (prisma.subscriber.findMany as any).mockResolvedValue([
      { id: "s1", email: "ok@example.com", token: "tok1" },
    ]);
    const req = makeReq("POST", { mode: "send", subject: "Hi", body: "Hello" });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(typeof res._body.delivered).toBe("number");
    expect(typeof res._body.failed).toBe("number");
  });
});

describe("POST mode=send - subject sanitization", () => {
  it("strips CRLF from subject before use", async () => {
    (prisma.broadcastLog.findFirst as any).mockResolvedValue(null);
    (prisma.broadcastLog.count   as any).mockResolvedValue(0);
    (prisma.broadcastLog.create  as any).mockResolvedValue({});
    (prisma.subscriber.findMany  as any).mockResolvedValue([
      { id: "s1", email: "ok@example.com", token: "tok1" },
    ]);
    (prisma.subscriber.updateMany as any).mockResolvedValue({});
    const req = makeReq("POST", { mode: "send", subject: "Hi\r\nInjected", body: "Hello" });
    const res = makeRes();
    await handler(req, res);
    const logCall = (prisma.broadcastLog.create as any).mock.calls[0][0];
    expect(logCall.data.subject).not.toContain("\r");
    expect(logCall.data.subject).not.toContain("\n");
  });
});

describe("POST /api/admin/broadcast - auth", () => {
  it("returns 400 for invalid Zod payload", async () => {
    const req = makeReq("POST", { mode: "send" });
    const res = makeRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });
});
