// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue(undefined),
      // Page-worthy events lazy-load the alert dispatcher, which reads this to
      // debounce. A non-zero count keeps these tests off the delivery path.
      count:  vi.fn().mockResolvedValue(1),
    },
  },
}));

vi.mock("@/server/db/client",   () => ({ default: mockPrisma }));
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
  it("writes the row with sanitized data", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await auditLog("login_account_locked", { ip: "9.9.9.9", path: "/api/login" });

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

    await expect(auditLog("test_event", {})).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(logged.type).toBe("[AUDIT_DB_ERROR]");
    expect(logged.event).toBe("test_event");
    expect(logged.error).toBe("connection refused");
  });

  it("resolves only once the row and the alert have both settled", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let writeRow, answerDebounce;
    mockPrisma.auditLog.create.mockReturnValueOnce(new Promise((r) => { writeRow = r; }));
    mockPrisma.auditLog.count.mockReturnValueOnce(new Promise((r) => { answerDebounce = r; }));

    let settled = false;
    const pending = auditLog("login_account_locked", {}).then(() => { settled = true; });
    await flushPromises();
    expect(settled).toBe(false);

    writeRow(undefined);
    await flushPromises();
    expect(settled).toBe(false);

    answerDebounce(1);
    await pending;
    expect(mockPrisma.auditLog.count).toHaveBeenCalledOnce();
  });
});

describe("audit alert sink", () => {
  it("emits [AUDIT_ALERT] on console.warn for security events with sanitized data", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    auditLog("login_account_locked", { ip: "1.2.3.4" });
    await flushPromises();

    expect(warnSpy).toHaveBeenCalledOnce();
    const logged = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(logged.type).toBe("[AUDIT_ALERT]");
    expect(logged.event).toBe("login_account_locked");
    expect(logged.ip).toBe(sha256("1.2.3.4"));
  });

  it("does not emit [AUDIT_ALERT] for non-security events", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    auditLog("roster_email_delivered", { emailHash: "abc" });
    await flushPromises();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("SECURITY_ALERT_EVENTS", () => {
  it("includes broadcast_invalid_token so brute-force attempts surface on alert sink", async () => {
    const { SECURITY_ALERT_EVENTS } = await import("@/server/security/node/audit-log");
    expect(SECURITY_ALERT_EVENTS.has("broadcast_invalid_token")).toBe(true);
  });
});
