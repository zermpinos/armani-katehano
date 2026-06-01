// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";

const { mockPrisma, mockSentry } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
    },
  },
  mockSentry: {
    captureMessage: vi.fn(),
  },
}));

vi.mock("@/server/db/client",   () => ({ default: mockPrisma }));
vi.mock("@sentry/nextjs",       () => mockSentry);
vi.mock("@/server/_internal/node-only", () => ({}));

import { auditLog } from "@/server/security/node/audit-log";

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

/** Flush all pending microtasks / promise continuations. */
async function flushPromises() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sanitize - IP hashing", () => {
  it("hashes the ip field before any output", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    auditLog("test_event", { ip: "1.2.3.4", path: "/foo" });
    await flushPromises();

    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.ip).toBe(sha256("1.2.3.4"));
    expect(logged.path).toBe("/foo");
  });

  it("leaves data unchanged when ip is absent", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    auditLog("test_event", { user: "alice" });
    await flushPromises();

    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.user).toBe("alice");
    expect(logged.ip).toBeUndefined();
  });

  it("leaves data unchanged when ip is not a string", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    auditLog("test_event", { ip: 12345 });
    await flushPromises();

    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(logged.ip).toBe(12345);
  });
});

describe("DB write", () => {
  it("fires a non-blocking auditLog.create with sanitized data", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    auditLog("login_account_locked", { ip: "9.9.9.9", path: "/api/login" });
    await flushPromises();

    expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        event: "login_account_locked",
        data:  { ip: sha256("9.9.9.9"), path: "/api/login" },
      },
    });
  });

  it("logs [AUDIT_DB_ERROR] to stderr and does not throw on DB failure", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.auditLog.create.mockRejectedValueOnce(new Error("connection refused"));

    expect(() => auditLog("test_event", {})).not.toThrow();
    await flushPromises();

    expect(errorSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(logged.type).toBe("[AUDIT_DB_ERROR]");
    expect(logged.event).toBe("test_event");
    expect(logged.error).toBe("connection refused");
  });
});

describe("Sentry integration", () => {
  it("sends security alert events to Sentry with sanitized data", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    auditLog("login_account_locked", { ip: "1.2.3.4" });
    await flushPromises();

    expect(mockSentry.captureMessage).toHaveBeenCalledOnce();
    const [, opts] = mockSentry.captureMessage.mock.calls[0];
    expect(opts.extra.ip).toBe(sha256("1.2.3.4"));
  });

  it("does not send non-security events to Sentry", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    auditLog("roster_email_delivered", { emailHash: "abc" });
    await flushPromises();

    expect(mockSentry.captureMessage).not.toHaveBeenCalled();
  });
});

describe("SECURITY_ALERT_EVENTS", () => {
  it("includes broadcast_invalid_token so brute-force attempts page Sentry", async () => {
    const { SECURITY_ALERT_EVENTS } = await import("@/server/security/node/audit-log");
    expect(SECURITY_ALERT_EVENTS.has("broadcast_invalid_token")).toBe(true);
  });
});
