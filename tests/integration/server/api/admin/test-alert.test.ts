// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-test-alert";
});

const { mockNotify } = vi.hoisted(() => ({ mockNotify: vi.fn() }));

vi.mock("@/server/integrations/email/client", () => ({ sendImportNotification: mockNotify }));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));

import handler from "../../../../../pages/api/admin/test-alert";
import { authedReq, mockRes, mockReq } from "../../db/__support__/games-admin-mocks";

beforeEach(() => {
  vi.clearAllMocks();
  mockNotify.mockResolvedValue("slack");
});

describe("POST /api/admin/test-alert", () => {
  it("sends the test kind and reports the channel it reached", async () => {
    const res = mockRes();
    await handler(authedReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(200);
    expect(mockNotify).toHaveBeenCalledWith({ kind: "test" });
    expect(res._body).toEqual({ ok: true, via: "slack" });
  });

  it("reports email when Slack did not take it", async () => {
    mockNotify.mockResolvedValue("email");
    const res = mockRes();
    await handler(authedReq({ method: "POST" }), res);
    expect(res._body.via).toBe("email");
  });

  // Nothing carried the alert. The request worked, so it is a 200, but the
  // answer is the one the admin needs to act on.
  it("reports none when no channel is configured", async () => {
    mockNotify.mockResolvedValue("none");
    const res = mockRes();
    await handler(authedReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(200);
    expect(res._body.via).toBe("none");
  });

  it("rejects any method other than POST", async () => {
    const res = mockRes();
    await handler(authedReq({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  // The endpoint posts to an external channel, so the property worth pinning is
  // that an unauthenticated caller cannot make it send anything. Which 4xx the
  // shared wrapper picks is its own business.
  it("refuses an unauthenticated caller", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }), res);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it("500s when the notification throws", async () => {
    mockNotify.mockRejectedValue(new Error("smtp exploded"));
    const res = mockRes();
    await handler(authedReq({ method: "POST" }), res);
    expect(res.statusCode).toBe(500);
  });
});
